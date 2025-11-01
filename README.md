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

**User Tables:**
```
users
  ├── id
  ├── username
  ├── email
  └── created_at, updated_at
```

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

**Resources Table (user learning materials):**
```
resources
  ├── id
  ├── user_id → users.id
  ├── name (e.g., "Naruto Volume 1")
  ├── type (book, manga, video_game, news_article, anime, podcast, website)
  ├── status (not_started, in_progress, completed, on_hold, dropped)
  ├── description
  ├── image_path (optional)
  ├── difficulty_level (beginner, intermediate, advanced)
  ├── tags (array)
  └── created_at, updated_at
```

### Database Setup

Note your .env must be configured with a user with the CREATEDB permission.

```bash
# Install Python dependencies
pip install -r requirements.txt

# Configure database credentials
cp env.example .env
# Edit .env with your PostgreSQL credentials

# 1. Create database
python scripts/create_db.py

# 2. Setup all schemas (users, kanji, dictionary, resources)
python scripts/setup_schemas.py

# 3. Setup kanji data from kanjidic2.xml
python scripts/setup_db.py

# 4. Setup dictionary data from JMdict_e (run after kanji setup)
python scripts/setup_jmdict.py

# 5. Setup local user for development
python scripts/setup_local.py
# This will prompt you for a username (defaults to your system username)

# To recreate database from scratch
python scripts/create_db.py --drop
python scripts/setup_schemas.py
python scripts/setup_db.py
python scripts/setup_jmdict.py
python scripts/setup_local.py
```

**Optional: Setup specific schemas only**
```bash
# Setup only users and resources tables
python scripts/setup_schemas.py --schemas users resources
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
- `GET /api/words` - Get dictionary entries (supports ?search=X, ?limit=X, ?offset=X)
- `GET /api/words/:id` - Get a single dictionary entry by ID
- `GET /health` - Health check

## Frontend

```bash
cd frontend
npm install
npm start
```

Runs the React app on http://localhost:3000

**Pages:**
- Home - Welcome page
- Word Dictionary - Browse and search Japanese words from JMDict
- Kanji Dictionary - Browse and search kanji characters

## Usage

TODO

## License

TODO

