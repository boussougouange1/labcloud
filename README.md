# LabCloud - Gestion Laboratoire Médical

Application SaaS de gestion de laboratoire médical avec authentification, gestion des patients, analyses médicales et facturation.

## 🚀 Déploiement sur GitHub + Vercel

### 1. Préparation Supabase

1. Créez un projet sur [Supabase](https://supabase.com)
2. Allez dans l'**SQL Editor** et exécutez le contenu de `sql/schema.sql`
3. Récupérez vos clés dans **Project Settings &gt; API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_KEY`

### 2. Déploiement GitHub

```bash
# Créer un nouveau repository
git init
git add .
git commit -m "Initial commit: LabCloud v1.0"
git branch -M main
git remote add origin https://github.com/votre-username/labcloud.git
git push -u origin main