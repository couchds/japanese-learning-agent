# Japanese Learning Agent

## Setup

### Prerequisites
- PostgreSQL

### Data Source
Download `kanjidic2.xml` from: https://www.edrdg.org/kanjidic/kanjd2index_legacy.html

Place in project root.

### Database Setup

Note your .env must be configured with a user with the CREATEDB

```bash
# Install dependencies
pip install -r requirements.txt

# Configure database credentials
cp env.example .env
# Edit .env with your credentials

# Create database
python scripts/create_db.py

# Setup schema and load data
python scripts/setup_db.py

# To recreate database from scratch
python scripts/create_db.py --drop
python scripts/setup_db.py
```

## Frontend

```bash
cd frontend
npm start
```

Runs the React app on http://localhost:3000

## Usage

TODO

## License

TODO

