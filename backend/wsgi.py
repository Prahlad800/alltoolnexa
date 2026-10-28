"""Production WSGI entry point for the PythonAnywhere web application."""
from app import create_app

application = create_app()
