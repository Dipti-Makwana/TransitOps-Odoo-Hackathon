from flask import Flask
from models import db

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
db.init_app(app)

with app.app_context():
    db.create_all()   # this creates database.db and the 3 tables inside it

@app.route('/')
def home():
    return "TransitOps backend is running!"

if __name__ == '__main__':
    app.run(debug=True)
    