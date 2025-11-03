# Japanese Learning Platform

Prototype (heavily vibe-coded!) for platform to learn Japanese using custom user-defined resources, and tracking user progress. This repo mainly has ideas I'm experimenting with and using for personal learning.

## Concept
The basic concept of this system (at the time of writing this, I'm on day 3 of development...) is that the user manages a collection of resources representing various media (video games, manga, books, etc.), which can then be linked to different words. The kanji these words are comprised of are then _also_ linked to the resource, and the platform will then assist the user in the learning of these words and kanji. There's a ton I'd like to do here, including agentic tooling and some kind of gamified XP system but this whole user-managed resource system" is the foundation for the system.

For example, I've recently been playing _Dragon Quest III_. So, in the application I create a resource representing this and I'm then able to track words that commonly appear over the course of the game:
<img width="1432" height="1034" alt="image" src="https://github.com/user-attachments/assets/4a9a4838-b16d-40c6-911d-4e2093713d35" />


## Setup

### Prerequisites
- **PostgreSQL** 12 or higher
- **Node.js** 16 or higher
- **Python** 3.8 or higher
- **npm** or **yarn** package manager

### Data Sources

**KANJIDIC2** (Kanji character data)
Download `kanjidic2.xml` from: https://www.edrdg.org/kanjidic/kanjd2index_legacy.html

**JMDict** (Japanese-English dictionary)
Download `JMdict_e` from: http://ftp.edrdg.org/pub/Nihongo/00INDEX.html

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

**Resources Tables (user learning materials):**
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

resource_kanji (links resources to kanji)
  ├── resource_id → resources.id
  ├── kanji_id → kanji.id
  ├── frequency (how often it appears)
  ├── notes (optional)
  └── created_at, updated_at

resource_words (links resources to dictionary words)
  ├── resource_id → resources.id
  ├── entry_id → dictionary_entries.id
  ├── frequency (how often it appears)
  ├── notes (optional)
  └── created_at, updated_at
```

### Database Setup

**Database Management:** This project uses **Prisma** as the ORM for managing database schemas and migrations. The schema is defined in `backend/prisma/schema.prisma`.

**Note:** Your `.env` must be configured with a PostgreSQL user with the CREATEDB permission.

```bash
# Install Python dependencies
pip install -r requirements.txt

# Configure database credentials
cp env.example .env
# Edit .env with your PostgreSQL credentials

# Also create .env in backend directory for Prisma
cp env.example backend/.env
# Or manually create backend/.env with DATABASE_URL

# 1. Create database
python scripts/create_db.py

# 2. Apply Prisma migrations to create schema
cd backend
npx prisma migrate deploy
cd ..

# 3. Setup kanji data from kanjidic2.xml
python scripts/setup_db.py

# 4. Setup dictionary data from JMdict_e (run after kanji setup)
python scripts/setup_jmdict.py

# 5. Setup local user for development
python scripts/setup_local.py
# This will prompt you for a username (defaults to your system username)

# To recreate database from scratch
python scripts/create_db.py --drop
cd backend && npx prisma migrate deploy && cd ..
python scripts/setup_db.py
python scripts/setup_jmdict.py
python scripts/setup_local.py
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
- `POST /api/recognize` - Recognize kanji from drawn image (requires recognition service)
- `GET /api/recognize/health` - Check recognition service status
- `GET /health` - Health check

## Recognition Service (Python)

The kanji drawing recognition feature requires a separate Python service using KanjiDraw.

### Setup Recognition Service

```bash
cd recognition_service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the service
python app.py
```

The recognition service will start on http://localhost:5000

**Note:** The backend automatically connects to the recognition service. Make sure it's running before using the kanji drawing feature.

### Environment Variables

Configure in `backend/.env`:
```bash
RECOGNITION_SERVICE_URL=http://localhost:5000  # Optional, defaults to localhost:5000
```

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
- Draw Kanji - Draw kanji characters with mouse, touchpad, or stylus for handwriting recognition (requires recognition service)
- Pronunciation Training - Record and manage pronunciation data for custom speech model training
- Test Model - Test your trained custom speech recognition model with live audio recordings

## Custom Speech Model Training

This platform includes a pronunciation training system that allows you to build your own speech recognition dataset as you learn Japanese.

### How It Works

1. **Record Pronunciations**: Navigate to the Pronunciation Training page and search for any word in the dictionary
2. **Save Reference Recordings**: Record yourself saying the word and mark good recordings as "Reference" pronunciations
3. **Build Training Data**: Over time, you'll accumulate a collection of labeled audio recordings
4. **Train Custom Models**: Use the collected data to train personalized speech recognition models

### Data Storage

**Audio Files**: Stored in `backend/uploads/pronunciations/`
- Format: `{userId}-{timestamp}.webm` (or .mp3, .wav, etc.)
- Supported formats: MP3, WAV, WebM, OGG, M4A

**Metadata**: Stored in PostgreSQL `pronunciation_recordings` table
- `is_reference = true`: High-quality recordings intended for model training
- `is_reference = false`: Practice recordings for personal progress tracking
- Links recordings to specific dictionary entries and users

### Future Training Capabilities

The collected data can be used for:
- Fine-tuning existing speech recognition models (Whisper, Wav2Vec 2.0)
- Building lightweight keyword spotting models for your learned vocabulary
- Creating personalized pronunciation assessment tools
- Tracking pronunciation improvement over time

### Exporting Training Data

To export your training data for model training, query reference recordings:
```sql
SELECT pr.*, de.* 
FROM pronunciation_recordings pr
JOIN dictionary_entries de ON pr.entry_id = de.id
WHERE pr.is_reference = true;
```

## Usage

### Running the Full Application

To run the complete application with all features:

1. **Start the PostgreSQL database** (ensure it's running)

2. **Start the recognition service** (in one terminal):
   ```bash
   cd recognition_service
   source venv/bin/activate  # If not already activated
   python app.py
   ```

3. **Start the backend API** (in another terminal):
   ```bash
   cd backend
   npm run dev
   ```

4. **Start the frontend** (in another terminal):
   ```bash
   cd frontend
   npm start
   ```

The application will be available at http://localhost:3000

**Note:** The kanji drawing recognition feature requires all three services to be running. Other features work with just the backend and frontend.

## Fair Use Notice

This README may reference or display small portions of copyrighted media (such as artwork or screenshots) from Dragon Quest III, © Square Enix.
Such materials are used solely for educational and illustrative purposes — to demonstrate Japanese language learning concepts — under the Fair Use provisions of U.S. copyright law (17 U.S.C. §107).

This project is non-commercial, transformative, and not affiliated with or endorsed by Square Enix.
All trademarks and copyrights remain the property of their respective owners.

