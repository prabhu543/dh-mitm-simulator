// --- STATE MANAGEMENT ---
        const DH_PARAMS = { p: 23, g: 5 };
        let state = {
            a: 6,
            b: 15,
            mA: 4,
            mB: 9,
            A: null,
            B: null,
            MA: null,
            MB: null,
            K_AM: null,
            K_MB: null,
            activeTx: null // holds current intercepted transmission metadata
        };

        // --- MATH HELPERS ---
        function modExp(base, exp, mod) {
            let res = 1n;
            let b = BigInt(base);
            let e = BigInt(exp);
            let m = BigInt(mod);
            b = b % m;
            while (e > 0n) {
                if (e % 2n === 1n) res = (res * b) % m;
                b = (b * b) % m;
                e = e / 2n;
            }
            return Number(res);
        }

        // --- LOGGING SYSTEM ---
        function logEvent(message, type = 'info') {
            const logContainer = document.getElementById('activity-log');
            const entry = document.createElement('div');
            const time = new Date().toLocaleTimeString();

            let colorClass = 'text-slate-300';
            let badge = '[INFO]';

            if (type === 'success') { colorClass = 'text-emerald-400'; badge = '[SUCCESS]'; }
            else if (type === 'attack') { colorClass = 'text-rose-400 font-bold'; badge = '[MITM ATTACK]'; }
            else if (type === 'secret') { colorClass = 'text-amber-300'; badge = '[KEY EXCHANGE]'; }
            else if (type === 'system') { colorClass = 'text-cyan-400'; badge = '[SYSTEM]'; }

            entry.className = `${colorClass} flex items-start gap-2`;
            entry.innerHTML = `<span class="text-slate-600">${time}</span> <span>${badge}</span> <span>${message}</span>`;
            
            logContainer.prepend(entry);
        }

        // --- CRYPTOGRAPHIC KDF & AES-GCM ENGINE (WebCrypto API) ---
        async function deriveKeyFromSecret(secret) {
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                "raw",
                enc.encode("DH_SECRET_" + secret),
                { name: "PBKDF2" },
                false,
                ["deriveKey"]
            );
            return crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: enc.encode("mitm_educational_salt"),
                    iterations: 1000,
                    hash: "SHA-256"
                },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );
        }

        async function encryptAESGCM(secret, plaintext) {
            const key = await deriveKeyFromSecret(secret);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const enc = new TextEncoder();
            const ciphertextBuffer = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                enc.encode(plaintext)
            );
            
            const ciphertextArray = new Uint8Array(ciphertextBuffer);
            const hex = Array.from(ciphertextArray).map(b => b.toString(16).padStart(2, '0')).join('');
            const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
            
            return { hex, ivHex, rawBuffer: ciphertextBuffer, iv };
        }

        async function decryptAESGCM(secret, hexCiphertext, ivHex) {
            const key = await deriveKeyFromSecret(secret);
            const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const ciphertextBytes = new Uint8Array(hexCiphertext.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                ciphertextBytes
            );
            const dec = new TextDecoder();
            return dec.decode(decryptedBuffer);
        }

        // --- SIMULATION LIFECYCLE HANDLERS ---
        function initializeDHKeys() {
            // Compute Alice public key A = g^a mod p
            state.A = modExp(DH_PARAMS.g, state.a, DH_PARAMS.p);
            // Compute Bob public key B = g^b mod p
            state.B = modExp(DH_PARAMS.g, state.b, DH_PARAMS.p);
            
            // Mallory calculates fake public keys
            state.MA = modExp(DH_PARAMS.g, state.mA, DH_PARAMS.p);
            state.MB = modExp(DH_PARAMS.g, state.mB, DH_PARAMS.p);

            // Secret key derivations under MITM key substitution
            // Alice receives MA -> K_AM = MA^a mod p
            state.K_AM = modExp(state.MA, state.a, DH_PARAMS.p);
            const K_AM_Mallory = modExp(state.A, state.mA, DH_PARAMS.p);

            // Bob receives MB -> K_MB = MB^b mod p
            state.K_MB = modExp(state.MB, state.b, DH_PARAMS.p);
            const K_MB_Mallory = modExp(state.B, state.mB, DH_PARAMS.p);

            // UI Updates
            document.getElementById('alice-public-key').innerText = `A = ${state.A}`;
            document.getElementById('alice-rec-public-key').innerText = `M_A = ${state.MA} (Substituted)`;
            document.getElementById('alice-shared-secret').innerText = `K_AM = ${state.K_AM}`;
            document.getElementById('alice-status').innerText = 'Keys Ready';
            document.getElementById('alice-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800';

            document.getElementById('bob-public-key').innerText = `B = ${state.B}`;
            document.getElementById('bob-rec-public-key').innerText = `M_B = ${state.MB} (Substituted)`;
            document.getElementById('bob-shared-secret').innerText = `K_MB = ${state.K_MB}`;
            document.getElementById('bob-status').innerText = 'Keys Ready';
            document.getElementById('bob-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800';

            document.getElementById('mallory-kam-secret').innerText = `K_AM = ${K_AM_Mallory} (Alice Side)`;
            document.getElementById('mallory-kmb-secret').innerText = `K_MB = ${K_MB_Mallory} (Bob Side)`;
            document.getElementById('mallory-status').innerText = 'Keys Intercepted';

            document.getElementById('btn-alice-send').disabled = false;

            logEvent(`Alice generated public key A=${state.A}. Bob generated public key B=${state.B}.`, 'secret');
            logEvent(`Mallory intercepted public exchange! Substituted M_A=${state.MA} to Alice & M_B=${state.MB} to Bob.`, 'attack');
            logEvent(`Shared Secrets established: Alice-Mallory K_AM=${state.K_AM}, Mallory-Bob K_MB=${state.K_MB}.`, 'success');
        }

        // --- FORWARD FLOW: ALICE -> MALLORY -> BOB ---
        async function aliceSendMessage() {
            const messageInput = document.getElementById('alice-message-input');
            const message = messageInput.value;
            if (!message) return;

            // Clear input after sending
            messageInput.value = '';

            animatePacket('alice-to-mallory');

            const encResult = await encryptAESGCM(state.K_AM, message);
            
            // Auto-decrypt immediately for Mallory using K_AM
            const autoDecrypted = await decryptAESGCM(state.K_AM, encResult.hex, encResult.ivHex);

            state.activeTx = {
                direction: 'A_TO_B',
                sender: 'Alice',
                intendedReceiver: 'Bob',
                originalText: message,
                ciphertextHex: encResult.hex,
                ivHex: encResult.ivHex,
                decryptedText: autoDecrypted,
                decryptionSecret: state.K_AM,
                forwardSecret: state.K_MB
            };

            // Update Mallory Panel with Auto-Decrypted Content
            document.getElementById('direction-tag').innerText = 'ALICE ➔ BOB';
            document.getElementById('direction-tag').className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-700 font-bold';
            document.getElementById('mallory-ciphertext-display').innerText = `${encResult.hex.substring(0, 32)}... [IV: ${encResult.ivHex}]`;
            document.getElementById('mallory-modified-input').value = autoDecrypted;
            
            document.getElementById('btn-mallory-forward-mod').disabled = false;
            document.getElementById('btn-mallory-forward-unmod').disabled = false;
            document.getElementById('btn-mallory-drop').disabled = false;
            
            document.getElementById('mallory-status').innerText = 'Packet Intercepted!';
            document.getElementById('mallory-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-600 text-white animate-pulse';

            logEvent(`Alice encrypted message with K_AM (${state.K_AM}) and transmitted.`, 'system');
            logEvent(`Mallory intercepted Alice's packet & AUTO-DECRYPTED plaintext: "${autoDecrypted}"`, 'attack');
        }

        // --- REVERSE FLOW: BOB -> MALLORY -> ALICE ---
        async function bobSendReply() {
            const replyInput = document.getElementById('bob-reply-input');
            const replyText = replyInput.value;
            if (!replyText) return;

            // Clear input after sending
            replyInput.value = '';

            animatePacket('bob-to-mallory');

            // Encrypt under K_MB
            const encResult = await encryptAESGCM(state.K_MB, replyText);

            // Auto-decrypt immediately for Mallory using K_MB
            const autoDecrypted = await decryptAESGCM(state.K_MB, encResult.hex, encResult.ivHex);

            state.activeTx = {
                direction: 'B_TO_A',
                sender: 'Bob',
                intendedReceiver: 'Alice',
                originalText: replyText,
                ciphertextHex: encResult.hex,
                ivHex: encResult.ivHex,
                decryptedText: autoDecrypted,
                decryptionSecret: state.K_MB,
                forwardSecret: state.K_AM
            };

            // Update Mallory Panel with Auto-Decrypted Reply
            document.getElementById('direction-tag').innerText = 'BOB ➔ ALICE';
            document.getElementById('direction-tag').className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 font-bold';
            document.getElementById('mallory-ciphertext-display').innerText = `${encResult.hex.substring(0, 32)}... [IV: ${encResult.ivHex}]`;
            document.getElementById('mallory-modified-input').value = autoDecrypted;

            document.getElementById('btn-mallory-forward-mod').disabled = false;
            document.getElementById('btn-mallory-forward-unmod').disabled = false;
            document.getElementById('btn-mallory-drop').disabled = false;

            document.getElementById('mallory-status').innerText = 'Reply Intercepted!';
            document.getElementById('mallory-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-600 text-white animate-pulse';

            logEvent(`Bob encrypted reply with K_MB (${state.K_MB}) and sent packet.`, 'system');
            logEvent(`Mallory intercepted Bob's reply & AUTO-DECRYPTED plaintext: "${autoDecrypted}"`, 'attack');
        }

        // --- MALLORY FORWARD & DROP CONTROLS ---
        async function malloryForwardMessage(isModified) {
            if (!state.activeTx) return;

            const textToForward = isModified ? 
                document.getElementById('mallory-modified-input').value : 
                state.activeTx.decryptedText;

            const isForwardPath = state.activeTx.direction === 'A_TO_B';
            const targetSecret = state.activeTx.forwardSecret;

            // Re-encrypt under target channel key
            const encResult = await encryptAESGCM(targetSecret, textToForward);

            if (isForwardPath) {
                animatePacket('mallory-to-bob');
                try {
                    // Bob receives and decrypts using K_MB
                    const bobDecrypted = await decryptAESGCM(targetSecret, encResult.hex, encResult.ivHex);

                    document.getElementById('bob-received-display').innerHTML = `<span class="text-emerald-400 font-bold font-mono">"${bobDecrypted}"</span>`;
                    document.getElementById('bob-status').innerText = 'Message Delivered';
                    document.getElementById('bob-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700';
                    document.getElementById('btn-bob-reply').disabled = false;

                    if (isModified) {
                        logEvent(`Mallory TAMPERED message to: "${textToForward}" & re-encrypted with K_MB.`, 'attack');
                        logEvent(`Bob decrypted message under K_MB. Bob believes Alice sent: "${bobDecrypted}"`, 'success');
                    } else {
                        logEvent(`Mallory forwarded original message re-encrypted under K_MB.`, 'info');
                        logEvent(`Bob received original message: "${bobDecrypted}"`, 'success');
                    }
                } catch (err) {
                    logEvent(`Bob failed to decrypt: AES-GCM tag mismatch.`, 'attack');
                }
            } else {
                // Reverse Path: Mallory -> Alice
                animatePacket('mallory-to-alice');
                try {
                    // Alice receives and decrypts using K_AM
                    const aliceDecrypted = await decryptAESGCM(targetSecret, encResult.hex, encResult.ivHex);

                    document.getElementById('alice-inbox-display').innerHTML = `<span class="text-cyan-400 font-bold font-mono">"${aliceDecrypted}"</span>`;
                    document.getElementById('alice-status').innerText = 'Reply Received';
                    document.getElementById('alice-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-700';

                    if (isModified) {
                        logEvent(`Mallory TAMPERED Bob's reply to: "${textToForward}" & re-encrypted with K_AM.`, 'attack');
                        logEvent(`Alice decrypted reply under K_AM. Alice believes Bob sent: "${aliceDecrypted}"`, 'success');
                    } else {
                        logEvent(`Mallory forwarded original reply re-encrypted under K_AM.`, 'info');
                        logEvent(`Alice received reply: "${aliceDecrypted}"`, 'success');
                    }
                } catch (err) {
                    logEvent(`Alice failed to decrypt: AES-GCM tag mismatch.`, 'attack');
                }
            }

            resetMalloryControls();
        }

        function malloryDropMessage() {
            if (!state.activeTx) return;

            if (state.activeTx.direction === 'A_TO_B') {
                document.getElementById('bob-received-display').innerHTML = `<span class="text-rose-400 italic font-mono">[Packet Suppressed by Mallory]</span>`;
                document.getElementById('bob-status').innerText = 'Packet Dropped';
                document.getElementById('bob-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800';
                logEvent(`Mallory DROPPED Alice's message! Packet never reached Bob.`, 'attack');
            } else {
                document.getElementById('alice-inbox-display').innerHTML = `<span class="text-rose-400 italic font-mono">[Reply Suppressed by Mallory]</span>`;
                document.getElementById('alice-status').innerText = 'Reply Dropped';
                document.getElementById('alice-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800';
                logEvent(`Mallory DROPPED Bob's reply! Packet never reached Alice.`, 'attack');
            }

            resetMalloryControls();
        }

        function resetMalloryControls() {
            state.activeTx = null;
            document.getElementById('btn-mallory-forward-mod').disabled = true;
            document.getElementById('btn-mallory-forward-unmod').disabled = true;
            document.getElementById('btn-mallory-drop').disabled = true;
            document.getElementById('mallory-status').innerText = 'Listening';
            document.getElementById('mallory-status').className = 'px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800';
            document.getElementById('mallory-ciphertext-display').innerText = 'No active transmission intercepted.';
            document.getElementById('mallory-modified-input').value = '';
            document.getElementById('direction-tag').innerText = 'IDLE';
            document.getElementById('direction-tag').className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400 font-bold';
        }

        function resetSimulation() {
            state.A = state.B = state.MA = state.MB = state.K_AM = state.K_MB = state.activeTx = null;
            
            document.getElementById('alice-public-key').innerText = 'Uncalculated';
            document.getElementById('alice-rec-public-key').innerText = 'None';
            document.getElementById('alice-shared-secret').innerText = 'Unestablished';
            document.getElementById('alice-status').innerText = 'Idle';
            document.getElementById('alice-inbox-display').innerText = 'No reply received yet';

            document.getElementById('bob-public-key').innerText = 'Uncalculated';
            document.getElementById('bob-rec-public-key').innerText = 'None';
            document.getElementById('bob-shared-secret').innerText = 'Unestablished';
            document.getElementById('bob-status').innerText = 'Idle';
            document.getElementById('bob-received-display').innerText = 'No message delivered yet';

            document.getElementById('mallory-kam-secret').innerText = 'Unestablished';
            document.getElementById('mallory-kmb-secret').innerText = 'Unestablished';
            
            document.getElementById('btn-alice-send').disabled = true;
            document.getElementById('btn-bob-reply').disabled = true;
            
            resetMalloryControls();
            logEvent('Simulation reset to initial state.', 'system');
        }

        // --- PACKET ANIMATION LOGIC ---
        function animatePacket(direction) {
            const pNode = document.getElementById('packet-node');
            const pIcon = document.getElementById('packet-icon');
            const pLabel = document.getElementById('packet-dir-label');

            pNode.classList.remove('hidden');
            
            if (direction === 'alice-to-mallory') {
                pIcon.className = 'fa-solid fa-arrow-right';
                pLabel.innerText = 'A ➔ M';
                pNode.style.left = '10%';
                setTimeout(() => { pNode.style.left = '45%'; }, 50);
            } else if (direction === 'mallory-to-bob') {
                pIcon.className = 'fa-solid fa-arrow-right';
                pLabel.innerText = 'M ➔ B';
                pNode.style.left = '50%';
                setTimeout(() => { pNode.style.left = '90%'; }, 50);
            } else if (direction === 'bob-to-mallory') {
                pIcon.className = 'fa-solid fa-arrow-left';
                pLabel.innerText = 'B ➔ M';
                pNode.style.left = '90%';
                setTimeout(() => { pNode.style.left = '50%'; }, 50);
            } else if (direction === 'mallory-to-alice') {
                pIcon.className = 'fa-solid fa-arrow-left';
                pLabel.innerText = 'M ➔ A';
                pNode.style.left = '45%';
                setTimeout(() => { pNode.style.left = '10%'; }, 50);
            }

            setTimeout(() => { pNode.classList.add('hidden'); }, 850);
        }

        // --- THEORY MODAL CONTROLS ---
        function toggleTheoryModal() {
            document.getElementById('theory-modal').classList.toggle('hidden');
        }
