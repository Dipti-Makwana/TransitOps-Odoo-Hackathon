from flask import Flask
from models import db, Vehicle, Driver, Trip, Maintenance, FuelLog, Expense
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
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

    # ---------- DASHBOARD KPIs ----------
@app.route('/dashboard', methods=['GET'])
def get_dashboard():
    total_vehicles = Vehicle.query.count()
    active_vehicles = Vehicle.query.filter(Vehicle.status != 'Retired').count()
    available_vehicles = Vehicle.query.filter_by(status='Available').count()
    vehicles_in_maintenance = Vehicle.query.filter_by(status='In Shop').count()

    active_trips = Trip.query.filter_by(trip_status='Dispatched').count()
    pending_trips = Trip.query.filter_by(trip_status='Draft').count()

    drivers_on_duty = Driver.query.filter_by(status='On Trip').count()

    # Fleet Utilization % = (vehicles currently On Trip / total active vehicles) * 100
    vehicles_on_trip = Vehicle.query.filter_by(status='On Trip').count()
    fleet_utilization = (vehicles_on_trip / active_vehicles * 100) if active_vehicles > 0 else 0

    return jsonify({
        "active_vehicles": active_vehicles,
        "available_vehicles": available_vehicles,
        "vehicles_in_maintenance": vehicles_in_maintenance,
        "active_trips": active_trips,
        "pending_trips": pending_trips,
        "drivers_on_duty": drivers_on_duty,
        "fleet_utilization_percent": round(fleet_utilization, 2)
    }), 200
 
@app.route('/vehicles/<int:id>', methods=['GET'])
def get_vehicle(id):
    v = Vehicle.query.get(id)
    if not v: return jsonify({"error": "not found"}), 404
    return jsonify({"id": v.id, "registration_number": v.registration_number,
        "model": v.model, "type": v.type, "max_load_capacity": v.max_load_capacity,
        "odometer": v.odometer, "status": v.status})

@app.route('/drivers/<int:id>', methods=['GET'])
def get_driver(id):
    d = Driver.query.get(id)
    if not d: return jsonify({"error": "not found"}), 404
    return jsonify({"id": d.id, "name": d.name, "license_number": d.license_number,
        "license_expiry_date": str(d.license_expiry_date), "safety_score": d.safety_score, "status": d.status})

@app.route('/trips', methods=['GET'])
def get_trips():
    trips = Trip.query.all()
    return jsonify([{"id": t.id, "source": t.source, "destination": t.destination,
        "vehicle_id": t.vehicle_id, "driver_id": t.driver_id, "cargo_weight": t.cargo_weight,
        "trip_status": t.trip_status} for t in trips])

@app.route('/maintenance', methods=['GET'])
def get_maintenance():
    m = Maintenance.query.all()
    return jsonify([{"id": x.id, "vehicle_id": x.vehicle_id, "description": x.description,
        "status": x.status} for x in m])

if __name__ == '__main__':
    app.run(debug=True)

    