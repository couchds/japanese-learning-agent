# Prisma Migration & Usage Guide

## ✅ Setup Complete!

Prisma is now set up with your Express backend. Your existing database has been baselined as migration `0_init`.

## 🔄 How to Create Migrations

### 1. Make Schema Changes
Edit `/home/couch/coding/japanese-learning-agent/backend/prisma/schema.prisma`

Example - Add a field:
```prisma
model users {
  id            Int         @id @default(autoincrement())
  username      String      @unique @db.VarChar(255)
  email         String?     @unique @db.VarChar(255)
  password_hash String      @db.VarChar(255)
  bio           String?     // <- NEW FIELD
  created_at    DateTime?   @default(now()) @db.Timestamp(6)
  updated_at    DateTime?   @default(now()) @db.Timestamp(6)
  resources     resources[]
}
```

### 2. Create & Apply Migration
```bash
cd backend
npx prisma migrate dev --name add_user_bio
```

This will:
- ✅ Create a new migration file
- ✅ Apply it to your database
- ✅ Regenerate Prisma Client with new types

### 3. Deploy to Production
```bash
npx prisma migrate deploy
```

## Common Migration Commands

```bash
# Create migration (development)
npx prisma migrate dev --name your_migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (⚠️ deletes all data!)
npx prisma migrate reset

# Create migration SQL without applying
npx prisma migrate dev --create-only --name your_migration_name
```

## 📝 Using Prisma Client

Prisma Client is already generated at `/home/couch/coding/japanese-learning-agent/backend/src/generated/prisma`

### Import in Your Routes
```typescript
import prisma from '../lib/prisma';

// TypeScript-safe queries!
const user = await prisma.users.findUnique({
  where: { username: 'couch' }
});
```

### Example Queries

**Find User:**
```typescript
const user = await prisma.users.findUnique({
  where: { id: 1 },
  include: { resources: true } // Include relations
});
```

**Create User:**
```typescript
const newUser = await prisma.users.create({
  data: {
    username: 'john',
    email: 'john@example.com',
    password_hash: hashedPassword
  }
});
```

**Update User:**
```typescript
await prisma.users.update({
  where: { id: 1 },
  data: { bio: 'Learning Japanese!' }
});
```

**Query Kanji:**
```typescript
const kanji = await prisma.kanji.findMany({
  where: { grade: 1 },
  include: { kanji_meanings: true },
  take: 50,
  orderBy: { frequency_rank: 'asc' }
});
```

**Complex Query Example (Words with Kanji):**
```typescript
const words = await prisma.dictionary_entries.findMany({
  where: {
    entry_kanji: {
      some: {
        is_common: true
      }
    }
  },
  include: {
    entry_kanji: true,
    entry_readings: true,
    entry_senses: {
      include: {
        sense_glosses: true
      }
    }
  },
  take: 50
});
```

## 🆚 Before & After

### Before (Raw SQL):
```typescript
const result = await pool.query(
  'SELECT * FROM users WHERE username = $1',
  [username]
);
const user = result.rows[0];
```

### After (Prisma):
```typescript
const user = await prisma.users.findUnique({
  where: { username }
});
```

**Benefits:**
- ✅ Full TypeScript autocomplete
- ✅ Type-safe queries
- ✅ No SQL injection vulnerabilities
- ✅ Easier to read and maintain

## 🔧 Prisma Studio (Database GUI)

View and edit your database in a GUI:
```bash
cd backend
npx prisma studio
```

Opens at http://localhost:5555

## 📚 Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Client API](https://www.prisma.io/docs/concepts/components/prisma-client)

## 🎯 Next Steps

1. **Try it out!** - Add a new field to the users table:
   ```bash
   # Edit prisma/schema.prisma, then:
   cd backend
   npx prisma migrate dev --name add_test_field
   ```

2. **Optional:** Migrate your existing routes to use Prisma instead of raw SQL

3. **Optional:** Use Prisma Studio to view your data:
   ```bash
   npx prisma studio
   ```

