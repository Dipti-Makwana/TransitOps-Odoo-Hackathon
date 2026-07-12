from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

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
    acquisition_cost = db.Column(db.Float, default=0)
    region = db.Column(db.String(50), default='Unassigned')

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

    # ---------- MAINTENANCE TABLE ----------
class Maintenance(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicle.id'), nullable=False)
    description = db.Column(db.String(100), nullable=False)  # e.g. "Oil Change"
    status = db.Column(db.String(20), default='Active')  # Active, Closed
    created_date = db.Column(db.Date, default=datetime.utcnow)

    # ---------- FUEL LOG TABLE ----------
class FuelLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicle.id'), nullable=False)
    liters = db.Column(db.Float, nullable=False)
    cost = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow)

# ---------- EXPENSE TABLE ----------
class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('vehicle.id'), nullable=False)
    type = db.Column(db.String(30), nullable=False)  # e.g. "Toll", "Maintenance"
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow)
    