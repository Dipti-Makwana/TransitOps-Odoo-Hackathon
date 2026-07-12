from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# ---------- VEHICLES TABLE ----------
class Vehicle(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    registration_number = db.Column(db.String(20), unique=True, nullable=False)
    model = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(30), nullable=False)
    max_load_capacity = db.Column(db.Float, nullable=False)
    odometer = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='Available')  # Available, On Trip, In Shop, Retired

# ---------- DRIVERS TABLE ----------
class Driver(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    license_number = db.Column(db.String(30), unique=True, nullable=False)
    license_expiry_date = db.Column(db.Date, nullable=False)
    safety_score = db.Column(db.Float, default=100)
    status = db.Column(db.String(20), default='Available')  # Available, On Trip, Off Duty, Suspended

# ---------- TRIPS TABLE ----------
class Trip(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(50), nullable=False)
    destination = db.Column(db.String(50), nullable=False)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicle.id'), nullable=False)
    driver_id = db.Column(db.Integer, db.ForeignKey('driver.id'), nullable=False)
    cargo_weight = db.Column(db.Float, nullable=False)
    trip_status = db.Column(db.String(20), default='Draft')  # Draft, Dispatched, Completed, Cancelled