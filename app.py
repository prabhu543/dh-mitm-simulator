from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def home():
    """Render the Diffie-Hellman MITM simulator dashboard."""
    return render_template("index.html")


if __name__ == "__main__":
    # Debug mode is suitable for local development only.
    app.run(host="127.0.0.1", port=5000, debug=True)
