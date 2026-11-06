# Diffie-Hellman Man-in-the-Middle (MITM) Attack Simulator

An interactive educational web application that demonstrates how an attacker
(Mallory) can intercept an unauthenticated Diffie-Hellman key exchange between
Alice and Bob.

🚀 **Live Demo:** [https://dh-mitm-simulator.onrender.com](https://dh-mitm-simulator.onrender.com)
## Features

- Visualizes Alice, Bob, and Mallory in a three-party dashboard.
- Demonstrates public-key substitution during Diffie-Hellman key exchange.
- Shows the two separate shared secrets established with Mallory.
- Simulates message encryption and decryption with the browser Web Crypto API
  (AES-GCM and PBKDF2/SHA-256).
- Allows Mallory to inspect, modify, forward, or drop messages.
- Demonstrates interception in both Alice-to-Bob and Bob-to-Alice directions.
- Includes a real-time activity log and packet movement animation.

## Project structure

```text
dh-mitm-attack-simulator/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    ├── js/
    │   └── script.js
    └── images/
```

## Requirements

- Python 3.9 or newer
- pip
- A modern browser with Web Crypto API support

## Run locally

1. Clone the repository:

   ```bash
   git clone https://github.com/prabhu543/dh-mitm-attack-simulator.git
   cd dh-mitm-attack-simulator
   ```

2. Create and activate a virtual environment:

   **Windows (PowerShell):**
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

   **Windows (Command Prompt):**
   ```bat
   python -m venv venv
   venv\Scripts\activate
   ```

   **macOS / Linux:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the Flask development server:

   ```bash
   python app.py
   ```

5. Open this address in your browser:

   http://127.0.0.1:5000

## How the demonstration works

1. Alice and Bob calculate their Diffie-Hellman public values.
2. Mallory substitutes her own public values during the exchange.
3. Alice establishes a shared secret with Mallory, and Bob establishes a
   different shared secret with Mallory.
4. Messages are encrypted with AES-GCM using keys derived from those
   demonstration secrets.
5. Mallory decrypts a message on one side and can forward the original,
   modify it, or drop it. If forwarded, she encrypts it for the other side.

## Important security note

This project is a **toy educational simulation**, not a secure communication
system. It uses very small Diffie-Hellman parameters (`p = 23`, `g = 5`) and
fixed demonstration private values. The PBKDF2 settings and salt are also
demonstration choices. Do not use this code or its cryptographic parameters
to protect real messages or sensitive data.

AES-GCM authenticates ciphertext under each channel key. It does not
authenticate the identity of the person with whom a Diffie-Hellman key is
established. Because the simulator gives Mallory both channel secrets, she
can decrypt and re-encrypt messages while each channel's integrity check
still succeeds.

## Technologies

- Python and Flask (local web server)
- HTML5
- CSS3
- JavaScript
- Web Crypto API (PBKDF2 and AES-GCM)
- Tailwind CSS CDN
- Font Awesome CDN

## Solutions & Mitigations: How to Prevent This Attack

A Man-in-the-Middle (MITM) attack can be prevented by using proper authentication and secure communication methods.

### 1. TLS (Transport Layer Security)
- TLS secures communication between two parties.
- It uses an authenticated handshake to establish a secure connection.
- It protects cryptographic parameters from unauthorized modification.
- It helps prevent attackers from manipulating the key exchange process.

### 2. Digital Certificate Signatures
- Digital certificates bind public keys to verified identities.
- Certificates are issued and digitally signed by trusted Certificate Authorities (CAs).
- Both parties can verify the identity of the other party before exchanging keys.
- This prevents an attacker from easily impersonating Alice or Bob.

### 3. Out-of-Band (OOB) Verification
- OOB verification checks key fingerprints through a separate, trusted communication channel.
- For example, Alice and Bob can compare their key fingerprints through a phone call.
- If the fingerprints do not match, they can identify a possible MITM attack.
- It provides an additional layer of security against impersonation and eavesdropping.

### Conclusion
Using TLS, digital certificates, and out-of-band verification helps protect Diffie-Hellman key exchange from Man-in-the-Middle attacks by ensuring authentication, integrity, and secure communication.
