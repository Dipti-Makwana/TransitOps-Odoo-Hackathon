from flask import Flask
from models import db, Vehicle, Driver, Trip, Maintenance, FuelLog, Expense

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

    # ---------- CREATE + DISPATCH TRIP ----------
@app.route('/trips', methods=['POST'])
def create_trip():
    data = request.json

    vehicle = Vehicle.query.get(data['vehicle_id'])
    driver = Driver.query.get(data['driver_id'])

    # Check 1: Vehicle exists and is Available
    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404
    if vehicle.status != 'Available':
        return jsonify({"error": f"Vehicle is {vehicle.status}, cannot dispatch"}), 400

    # Check 2: Driver exists and is Available
    if not driver:
        return jsonify({"error": "Driver not found"}), 404
    if driver.status != 'Available':
        return jsonify({"error": f"Driver is {driver.status}, cannot dispatch"}), 400

    # Check 3: License not expired
    if driver.license_expiry_date < datetime.now().date():
        return jsonify({"error": "Driver's license has expired"}), 400

    # Check 4: Cargo weight within limit
    if data['cargo_weight'] > vehicle.max_load_capacity:
        return jsonify({"error": f"Cargo weight {data['cargo_weight']}kg exceeds vehicle limit {vehicle.max_load_capacity}kg"}), 400

    # All checks passed — create trip
    trip = Trip(
        source=data['source'],
        destination=data['destination'],
        vehicle_id=vehicle.id,
        driver_id=driver.id,
        cargo_weight=data['cargo_weight'],
        trip_status='Dispatched'
    )

    # Auto-switch statuses (business rule from PDF)
    vehicle.status = 'On Trip'
    driver.status = 'On Trip'

    db.session.add(trip)
    db.session.commit()

    return jsonify({"message": "Trip dispatched successfully", "trip_id": trip.id}), 201

    # ---------- VIEW ALL VEHICLES ----------
@app.route('/vehicles', methods=['GET'])
def get_vehicles():
    vehicles = Vehicle.query.all()
    result = [{"id": v.id, "registration_number": v.registration_number, "status": v.status} for v in vehicles]
    return jsonify(result)

# ---------- VIEW ALL DRIVERS ----------
@app.route('/drivers', methods=['GET'])
def get_drivers():
    drivers = Driver.query.all()
    result = [{"id": d.id, "name": d.name, "status": d.status} for d in drivers]
    return jsonify(result)

# ---------- COMPLETE TRIP ----------
@app.route('/trips/<int:trip_id>/complete', methods=['PUT'])
def complete_trip(trip_id):
    trip = Trip.query.get(trip_id)

    if not trip:
        return jsonify({"error": "Trip not found"}), 404
    if trip.trip_status != 'Dispatched':
        return jsonify({"error": f"Trip is {trip.trip_status}, cannot complete"}), 400

    vehicle = Vehicle.query.get(trip.vehicle_id)
    driver = Driver.query.get(trip.driver_id)

    trip.trip_status = 'Completed'
    vehicle.status = 'Available'
    driver.status = 'Available'

    db.session.commit()

    return jsonify({"message": "Trip completed", "trip_id": trip.id}), 200

    # ---------- CANCEL TRIP ----------
@app.route('/trips/<int:trip_id>/cancel', methods=['PUT'])
def cancel_trip(trip_id):
    trip = Trip.query.get(trip_id)

    if not trip:
        return jsonify({"error": "Trip not found"}), 404
    if trip.trip_status != 'Dispatched':
        return jsonify({"error": f"Trip is {trip.trip_status}, cannot cancel"}), 400

    vehicle = Vehicle.query.get(trip.vehicle_id)
    driver = Driver.query.get(trip.driver_id)

    trip.trip_status = 'Cancelled'
    vehicle.status = 'Available'
    driver.status = 'Available'

    db.session.commit()

    return jsonify({"message": "Trip cancelled", "trip_id": trip.id}), 200

    # ---------- CREATE MAINTENANCE RECORD ----------
@app.route('/maintenance', methods=['POST'])
def create_maintenance():
    data = request.json
    vehicle = Vehicle.query.get(data['vehicle_id'])

    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404

    maintenance = Maintenance(
        vehicle_id=vehicle.id,
        description=data['description']
    )

    vehicle.status = 'In Shop'  # auto-switch, per business rule

    db.session.add(maintenance)
    db.session.commit()

    return jsonify({"message": "Maintenance record created", "maintenance_id": maintenance.id}), 201

# ---------- CLOSE MAINTENANCE RECORD ----------
@app.route('/maintenance/<int:maintenance_id>/close', methods=['PUT'])
def close_maintenance(maintenance_id):
    maintenance = Maintenance.query.get(maintenance_id)

    if not maintenance:
        return jsonify({"error": "Maintenance record not found"}), 404
    if maintenance.status != 'Active':
        return jsonify({"error": "Maintenance record already closed"}), 400

    vehicle = Vehicle.query.get(maintenance.vehicle_id)

    maintenance.status = 'Closed'

    # Restore vehicle to Available, unless it's Retired
    if vehicle.status != 'Retired':
        vehicle.status = 'Available'

    db.session.commit()

    return jsonify({"message": "Maintenance closed, vehicle status updated"}), 200

    # ---------- ADD FUEL LOG ----------
@app.route('/fuel', methods=['POST'])
def add_fuel_log():
    data = request.json
    vehicle = Vehicle.query.get(data['vehicle_id'])

    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404

    fuel_log = FuelLog(
        vehicle_id=vehicle.id,
        liters=data['liters'],
        cost=data['cost']
    )

    db.session.add(fuel_log)
    db.session.commit()

    return jsonify({"message": "Fuel log added", "fuel_log_id": fuel_log.id}), 201

# ---------- ADD EXPENSE ----------
@app.route('/expenses', methods=['POST'])
def add_expense():
    data = request.json
    vehicle = Vehicle.query.get(data['vehicle_id'])

    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404

    expense = Expense(
        vehicle_id=vehicle.id,
        type=data['type'],
        amount=data['amount']
    )

    db.session.add(expense)
    db.session.commit()

    return jsonify({"message": "Expense added", "expense_id": expense.id}), 201

# ---------- OPERATIONAL COST PER VEHICLE ----------
@app.route('/vehicles/<int:vehicle_id>/cost', methods=['GET'])
def get_vehicle_cost(vehicle_id):
    vehicle = Vehicle.query.get(vehicle_id)

    if not vehicle:
        return jsonify({"error": "Vehicle not found"}), 404

    fuel_logs = FuelLog.query.filter_by(vehicle_id=vehicle_id).all()
    expenses = Expense.query.filter_by(vehicle_id=vehicle_id).all()

    total_fuel_cost = sum(f.cost for f in fuel_logs)
    total_expense_cost = sum(e.amount for e in expenses)
    total_operational_cost = total_fuel_cost + total_expense_cost

    return jsonify({
        "vehicle_id": vehicle_id,
        "total_fuel_cost": total_fuel_cost,
        "total_expense_cost": total_expense_cost,
        "total_operational_cost": total_operational_cost
    }), 200

if __name__ == '__main__':
    app.run(debug=True)

    