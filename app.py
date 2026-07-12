from flask import Flask
from models import db, Vehicle, Driver, Trip

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
db.init_app(app)

with app.app_context():
    db.create_all()   # this creates database.db and the 3 tables inside it

@app.route('/')
def home():
    return "TransitOps backend is running!"
  
from flask import request, jsonify
from datetime import datetime

# ---------- ADD VEHICLE ----------
@app.route('/vehicles', methods=['POST'])
def add_vehicle():
    data = request.json
    vehicle = Vehicle(
        registration_number=data['registration_number'],
        model=data['model'],
        type=data['type'],
        max_load_capacity=data['max_load_capacity']
    )
    db.session.add(vehicle)
    db.session.commit()
    return jsonify({"message": "Vehicle added", "id": vehicle.id}), 201

# ---------- ADD DRIVER ----------
@app.route('/drivers', methods=['POST'])
def add_driver():
    data = request.json
    driver = Driver(
        name=data['name'],
        license_number=data['license_number'],
        license_expiry_date=datetime.strptime(data['license_expiry_date'], '%Y-%m-%d')
    )
    db.session.add(driver)
    db.session.commit()
    return jsonify({"message": "Driver added", "id": driver.id}), 201

if __name__ == '__main__':
    app.run(debug=True)
    