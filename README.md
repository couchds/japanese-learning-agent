# Japanese Learning Agent

## Setup

### Prerequisites
- PostgreSQL

### Data Sources

**KANJIDIC2** (Kanji character data)
Download `kanjidic2.xml` from: https://www.edrdg.org/kanjidic/kanjd2index_legacy.html

**JMDict** (Japanese-English dictionary)
Download `JMdict_e` from: http://www.edrdg.org/jmdict/edict_doc.html

Place both files in project root.

### Database Schema

**Kanji Tables:**
```
kanji
  ├── id
  ├── literal (e.g., "食")
  ├── meanings (via kanji_meanings table)
  ├── on_readings, kun_readings
  ├── grade, jlpt_level, frequency_rank
  └── stroke_count, radical

kanji_meanings
  ├── kanji_id → kanji.id
  └── meaning (English)
```

**Dictionary Tables:**
```
dictionary_entries (main entry)
  ├── id
  └── entry_id (JMDict sequence number)

entry_kanji (word forms)
  ├── entry_id → dictionary_entries.id
  ├── kanji (e.g., "食べる")
  └── is_common, priority_tags

entry_readings (pronunciations)
  ├── entry_id → dictionary_entries.id
  ├── reading (e.g., "たべる")
  └── is_common, priority_tags

entry_senses (meanings/definitions)
  ├── entry_id → dictionary_entries.id
  ├── sense_order
  └── parts_of_speech, fields, misc

sense_glosses (English translations)
  ├── sense_id → entry_senses.id
  ├── gloss (e.g., "to eat")
  └── gloss_order
```

**Linking Table (connects words to kanji):**
```
entry_kanji_characters
  ├── entry_kanji_id → entry_kanji.id
  ├── kanji_id → kanji.id
  └── position (position in word)
```

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

# Setup kanji data
python scripts/setup_db.py

# Setup dictionary data (run after kanji setup)
python scripts/setup_jmdict.py

# To recreate database from scratch
python scripts/create_db.py --drop
python scripts/setup_db.py
python scripts/setup_jmdict.py
```

## Backend API

```bash
cd backend
npm install
npm run dev
```

Runs the Express API on http://localhost:3001

**API Endpoints:**
- `GET /api/kanji` - Get all kanji (supports ?grade=X, ?jlpt=X, ?limit=X, ?offset=X)
- `GET /api/kanji/:id` - Get a single kanji by ID
- `GET /health` - Health check

## Frontend

```bash
cd frontend
npm install
npm start
```

Runs the React app on http://localhost:3000

## Usage

TODO

## License

TODO

