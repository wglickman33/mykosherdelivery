#!/bin/bash

# MyKosherDelivery - Complete Setup Script
# This script sets up the entire application with security fixes

set -e  # Exit on any error

echo "🚀 MyKosherDelivery - Complete Setup Script"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js $(node -v) detected"
}

# Check if PostgreSQL is installed
check_postgres() {
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL is not installed or not in PATH."
        print_warning "Please install PostgreSQL and ensure it's running."
        print_warning "You can continue setup and configure the database later."
        read -p "Continue without PostgreSQL check? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        print_success "PostgreSQL detected"
    fi
}

# Install frontend dependencies
install_frontend_deps() {
    print_status "Installing frontend dependencies..."
    npm install
    print_success "Frontend dependencies installed"
}

# Install backend dependencies
install_backend_deps() {
    print_status "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    print_success "Backend dependencies installed"
}

# Setup environment files
setup_env_files() {
    print_status "Setting up environment files..."
    
    # Frontend .env
    if [ ! -f ".env" ]; then
        cp .env.example .env
        print_success "Frontend .env file created from template"
    else
        print_warning "Frontend .env file already exists"
    fi
    
    # Backend .env
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env 2>/dev/null || cp backend/.env backend/.env.backup
        print_success "Backend .env file created from template"
    else
        print_warning "Backend .env file already exists"
    fi
    
    print_warning "⚠️  IMPORTANT: You must update the .env files with your actual API keys!"
    print_warning "   - Update .env with your frontend API keys"
    print_warning "   - Update backend/.env with your backend configuration"
    print_warning "   - See SECURITY_FIXES_IMPLEMENTED.md for details"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    if command -v psql &> /dev/null; then
        cd backend
        npm run setup 2>/dev/null || {
            print_warning "Database setup failed. You may need to:"
            print_warning "1. Start PostgreSQL service"
            print_warning "2. Update DATABASE_URL in backend/.env"
            print_warning "3. Run 'npm run setup' manually in the backend directory"
        }
        cd ..
    else
        print_warning "Skipping database setup - PostgreSQL not available"
        print_warning "Run 'cd backend && npm run setup' after installing PostgreSQL"
    fi
}

# Security check
security_check() {
    print_status "Running security checks..."
    
    # Check for placeholder values in .env files
    if grep -q "placeholder" .env 2>/dev/null; then
        print_error "Frontend .env file contains placeholder values!"
        print_error "Please update .env with your actual API keys"
    fi
    
    if grep -q "placeholder" backend/.env 2>/dev/null; then
        print_error "Backend .env file contains placeholder values!"
        print_error "Please update backend/.env with your actual configuration"
    fi
    
    # Check if .env files are in .gitignore
    if ! grep -q "^\.env$" .gitignore; then
        print_error ".env files are not properly ignored by git!"
        print_error "This could lead to security vulnerabilities"
    else
        print_success "Environment files are properly ignored by git"
    fi
    
    print_success "Security checks completed"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p backend/logs
    mkdir -p backend/uploads
    mkdir -p backend/uploads/temp
    
    print_success "Directories created"
}

# Main setup function
main() {
    echo
    print_status "Starting MyKosherDelivery setup..."
    echo
    
    # Pre-flight checks
    check_node
    check_postgres
    
    # Setup steps
    install_frontend_deps
    install_backend_deps
    setup_env_files
    create_directories
    setup_database
    security_check
    
    echo
    print_success "🎉 Setup completed successfully!"
    echo
    print_status "Next steps:"
    echo "1. Update your .env files with actual API keys (see SECURITY_FIXES_IMPLEMENTED.md)"
    echo "2. Start the backend: cd backend && npm run dev"
    echo "3. Start the frontend: npm run dev"
    echo "4. Visit http://localhost:5173 to see your application"
    echo
    print_warning "⚠️  SECURITY REMINDER:"
    print_warning "   - All previous API keys have been revoked for security"
    print_warning "   - You MUST generate new API keys for all services"
    print_warning "   - Never commit .env files to version control"
    print_warning "   - Use test keys in development, live keys only in production"
    echo
    print_status "For detailed security information, see SECURITY_FIXES_IMPLEMENTED.md"
    print_status "For development help, see README.md"
}

# Run main function
main "$@"