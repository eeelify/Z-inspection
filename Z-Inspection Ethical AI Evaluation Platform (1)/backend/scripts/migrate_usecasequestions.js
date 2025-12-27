/**
 * Migration script for usecasequestions collection
 * 
 * Updates existing questions to new format with:
 * - key (stable string identifier)
 * - tag (AI Act reference)
 * - placeholder
 * - helper
 * - isActive
 * 
 * CRITICAL: Preserves existing _id to maintain answer references in usecases.answers
 * 
 * Run with: npm run migrate:usecasequestions
 * Or: node backend/scripts/migrate_usecasequestions.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI or MONGODB_URI environment variable not found!');
}

// Schema definitions (must match server.js)
const UseCaseQuestionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  key: { type: String },
  questionEn: { type: String, required: true },
  questionTr: { type: String, required: true },
  type: { type: String, required: true },
  options: { type: [String], default: [] },
  order: { type: Number, default: 0 },
  tag: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  helper: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { collection: 'usecasequestions' });

const UseCaseQuestion = mongoose.model('UseCaseQuestion', UseCaseQuestionSchema);

// NEW QUESTIONS SET - SINGLE SOURCE OF TRUTH
const NEW_USECASE_QUESTIONS = [
  // 0) System identity and scope
  { key: "S0_Q1", order: 1, tag: "AI Act traceability / documentation readiness", question_en: "What is the AI system name, product name, and current version (incl. model version/build hash)?", question_tr: "AI sisteminin adı, ürün adı ve güncel versiyonu nedir (model versiyonu/build hash dahil)?", placeholder: "Define your system identity…", helper: "e.g., System: Z-Inspection | Product: Ethical AI Evaluation | Model: gpt-4o-mini | Build: 2025.01.12", isActive: true },
  { key: "S0_Q2", order: 2, tag: "", question_en: "Describe the intended purpose and intended users of the system (one paragraph).", question_tr: "Sistemin amaçlanan kullanım amacı ve hedef kullanıcıları nedir (tek paragraf)?", placeholder: "Define intended purpose and users…", helper: "e.g., \"Supports auditors by summarizing evaluation evidence for compliance reporting.\"", isActive: true },
  { key: "S0_Q3", order: 3, tag: "", question_en: "List explicitly non-intended uses and reasonably foreseeable misuse scenarios.", question_tr: "Amaçlanmayan kullanımları ve makul şekilde öngörülebilir kötüye kullanım senaryolarını açıkça listeleyin.", placeholder: "List non-intended uses and foreseeable misuse…", helper: "e.g., \"Not for medical diagnosis; not for hiring decisions; not for surveillance.\"", isActive: true },
  { key: "S0_Q4", order: 4, tag: "", question_en: "Where will it be deployed (web/app/API/on-prem), and what other systems does it integrate with?", question_tr: "Nerede çalışacak (web/app/API/on-prem) ve hangi sistemlerle entegre olacak?", placeholder: "Describe deployment and integrations…", helper: "e.g., \"Web app + REST API; integrates with LMS and SSO (Okta).\"", isActive: true },

  // 1) AI Act classification and risk tiering
  { key: "S1_Q5", order: 5, tag: "AI Act Art. 6, Annex III", question_en: "Does the system qualify as \"high-risk\" under the AI Act (Article 6 and/or Annex III)? Provide justification.", question_tr: "Sistem AI Act'e göre \"high-risk\" kapsamına giriyor mu (Madde 6 ve/veya Ek III)? Gerekçesini yazın.", placeholder: "State your classification and rationale…", helper: "e.g., \"High-risk because it is used in … (Annex III category …).\"", isActive: true },
  { key: "S1_Q6", order: 6, tag: "AI Act Art. 6", question_en: "If you claim it is NOT high-risk, document the rationale and the criteria used.", question_tr: "High-risk olmadığını iddia ediyorsanız, gerekçeyi ve kullanılan kriterleri dokümante edin.", placeholder: "Explain why it is not high-risk…", helper: "e.g., \"Not used in Annex III areas; no legal/real-world significant effect.\"", isActive: true },

  // 2) Risk management (provider process)
  { key: "S2_Q7", order: 7, tag: "AI Act Art. 9", question_en: "Do you have a documented risk management system covering the whole lifecycle? Summarize.", question_tr: "Tüm yaşam döngüsünü kapsayan dokümante risk yönetim sisteminiz var mı? Özetleyin.", placeholder: "Summarize your risk management process…", helper: "e.g., \"Risk register + quarterly reviews + release gate + incident playbook.\"", isActive: true },
  { key: "S2_Q8", order: 8, tag: "AI Act Art. 9", question_en: "List the top 5 risks (health/safety/fundamental rights), with likelihood/impact and mitigations.", question_tr: "İlk 5 riski (sağlık/güvenlik/temel haklar) olasılık/etki ve azaltım önlemleriyle yazın.", placeholder: "List risks with likelihood/impact/mitigation…", helper: "e.g., \"Risk: bias (Med/High) → Mitigation: subgroup eval + thresholds.\"", isActive: true },
  { key: "S2_Q9", order: 9, tag: "", question_en: "Who approves risk acceptance and releases? Provide the governance/RACI.", question_tr: "Risk kabulünü ve sürüm yayınını kim onaylıyor? Yönetişim/RACI paylaşın.", placeholder: "Define governance and owners…", helper: "e.g., \"Product owner approves; compliance signs off; security reviews.\"", isActive: true },

  // 3) Data and data governance
  { key: "S3_Q10", order: 10, tag: "AI Act Art. 10", question_en: "What data sources are used for training/validation/testing (and for runtime, if applicable)?", question_tr: "Eğitim/doğrulama/test (ve varsa çalışma zamanı) için hangi veri kaynakları kullanılıyor?", placeholder: "List data sources and access…", helper: "e.g., \"Licensed dataset X; internal logs (anonymized); user inputs at runtime.\"", isActive: true },
  { key: "S3_Q11", order: 11, tag: "AI Act Art. 10", question_en: "Describe dataset representativeness (languages, geographies, demographics) and known gaps.", question_tr: "Veri setinin temsil gücünü (dil/coğrafya/demografi) ve bilinen boşlukları açıklayın.", placeholder: "Describe coverage and gaps…", helper: "e.g., \"Primarily TR/EN; limited coverage for age 65+.\"", isActive: true },
  { key: "S3_Q12", order: 12, tag: "AI Act Art. 10", question_en: "What quality controls exist (label QA, noise checks, leakage/contamination checks)?", question_tr: "Kalite kontrolleri neler (etiket QA, gürültü kontrolü, leakage/contamination kontrolü)?", placeholder: "Describe QA and checks…", helper: "e.g., \"Double-labeling; inter-annotator agreement; leakage scans.\"", isActive: true },
  { key: "S3_Q13", order: 13, tag: "AI Act Art. 10 + Trustworthy AI fairness", question_en: "What bias detection and mitigation steps were performed? Provide results/metrics if available.", question_tr: "Bias tespiti ve azaltımı için hangi adımlar atıldı? Varsa sonuç/metric paylaşın.", placeholder: "Describe bias evaluation and mitigations…", helper: "e.g., \"Equalized odds gap < X; reweighting + additional data.\"", isActive: true },

  // 4) Technical documentation and traceability artifacts
  { key: "S4_Q14", order: 14, tag: "AI Act Art. 11", question_en: "What technical documentation exists (model card, data sheet, architecture, evaluation report)? Provide links/attachments.", question_tr: "Hangi teknik dokümanlar var (model card, data sheet, mimari, değerlendirme raporu)? Link/ek verin.", placeholder: "List docs and where to find them…", helper: "e.g., \"Model card: /docs/model-card; Eval report: link…\"", isActive: true },
  { key: "S4_Q15", order: 15, tag: "AI Act Art. 11 – keeping documentation up to date", question_en: "How do you manage versioning and change logs (model updates, data updates, config changes)?", question_tr: "Versiyonlama ve değişiklik kayıtlarını nasıl yönetiyorsunuz (model/veri/konfig değişimleri)?", placeholder: "Describe versioning and changelog practice…", helper: "e.g., \"Semantic versioning; release notes; audit trail for config.\"", isActive: true },

  // 5) Logging and record-keeping
  { key: "S5_Q16", order: 16, tag: "AI Act Art. 12", question_en: "What events are logged (inputs/outputs, model version, confidence, user actions)? Retention period?", question_tr: "Hangi olaylar loglanıyor (girdi/çıktı, model versiyonu, güven skoru, kullanıcı aksiyonları)? Saklama süresi?", placeholder: "Describe logs and retention…", helper: "e.g., \"Request/response metadata, model version; retained 90 days.\"", isActive: true },
  { key: "S5_Q17", order: 17, tag: "AI Act Art. 12", question_en: "How do logs support auditability, incident investigation, and post-market monitoring?", question_tr: "Loglar denetim, olay inceleme ve post-market izlemeyi nasıl destekliyor?", placeholder: "Explain audit and investigation use…", helper: "e.g., \"Trace decisions, reproduce outputs, detect drift, investigate incidents.\"", isActive: true },

  // 6) Transparency and information to deployers/users
  { key: "S6_Q18", order: 18, tag: "AI Act Art. 13", question_en: "What information/instructions do you provide to deployers (limitations, correct use, known failure modes)?", question_tr: "Deployerlara hangi bilgi/talimatları veriyorsunuz (limitler, doğru kullanım, bilinen hata modları)?", placeholder: "List what you disclose to deployers…", helper: "e.g., \"User guide, limitations, safety constraints, known failure modes.\"", isActive: true },
  { key: "S6_Q19", order: 19, tag: "AI Act Art. 13 + Trustworthy AI transparency", question_en: "How is uncertainty communicated (confidence, disclaimers, calibration, \"do not use for …\")?", question_tr: "Belirsizlik nasıl iletiliyor (confidence, uyarılar, kalibrasyon, \"şu amaçla kullanmayın\")?", placeholder: "Describe uncertainty communication…", helper: "e.g., \"Confidence indicator + warnings + 'not for diagnosis' banner.\"", isActive: true },
  { key: "S6_Q20", order: 20, tag: "Trustworthy AI transparency", question_en: "What explainability is available (global/local explanations), for whom, and in what format?", question_tr: "Hangi açıklanabilirlik sağlanıyor (global/local), kime ve hangi formatta?", placeholder: "Describe explainability outputs…", helper: "e.g., \"Local reasons for admins; simplified explanations for end users.\"", isActive: true },

  // 7) Human oversight and over-reliance controls
  { key: "S7_Q21", order: 21, tag: "AI Act Art. 14", question_en: "Define the human oversight model (HITL/HOTL/HIC): when can humans override or stop the system?", question_tr: "İnsan gözetimi modelini tanımlayın (HITL/HOTL/HIC): insanlar ne zaman override/stop yapabilir?", placeholder: "Describe oversight and override points…", helper: "e.g., \"Human approval required for high-impact actions; kill switch exists.\"", isActive: true },
  { key: "S7_Q22", order: 22, tag: "AI Act Art. 14", question_en: "What concrete measures prevent over-reliance (forced verification steps, UI warnings, training, throttles)?", question_tr: "Aşırı güveni engelleyen somut önlemler neler (zorunlu doğrulama, UI uyarı, eğitim, kısıtlama)?", placeholder: "List anti-overreliance controls…", helper: "e.g., \"Double-check prompts, warnings, mandatory review, user training.\"", isActive: true },

  // 8) Accuracy, robustness, cybersecurity
  { key: "S8_Q23", order: 23, tag: "AI Act Art. 15", question_en: "What are your target performance metrics and acceptance thresholds (per context of use)?", question_tr: "Hedef performans metrikleri ve kabul eşikleri nedir (kullanım bağlamına göre)?", placeholder: "List metrics + thresholds…", helper: "e.g., \"F1 ≥ 0.85; latency ≤ 300ms; subgroup gap ≤ 0.05.\"", isActive: true },
  { key: "S8_Q24", order: 24, tag: "AI Act Art. 15", question_en: "What robustness tests were run (distribution shift, edge cases, adversarial/abuse)? Summarize outcomes.", question_tr: "Hangi sağlamlık testleri yapıldı (distribution shift, edge case, adversarial/abuse)? Sonuçları özetleyin.", placeholder: "Summarize robustness tests and results…", helper: "e.g., \"Stress tests on edge cases; prompt injection eval; passed criteria X.\"", isActive: true },
  { key: "S8_Q25", order: 25, tag: "AI Act Art. 15", question_en: "What cybersecurity measures exist (access controls, rate limiting, supply-chain security, monitoring)?", question_tr: "Siber güvenlik önlemleri neler (erişim kontrolü, rate limit, tedarik zinciri güvenliği, izleme)?", placeholder: "Summarize security controls…", helper: "e.g., \"RBAC, OAuth, rate limits, dependency scanning, monitoring.\"", isActive: true },

  // 9) Post-market monitoring and serious incident reporting
  { key: "S9_Q26", order: 26, tag: "AI Act Art. 72", question_en: "Do you have a documented post-market monitoring plan (signals collected, KPIs, drift detection, review cadence)?", question_tr: "Dokümante post-market izleme planınız var mı (toplanan sinyaller, KPI, drift tespiti, gözden geçirme sıklığı)?", placeholder: "Describe monitoring plan…", helper: "e.g., \"Weekly KPI review; drift alerts; rollback playbook.\"", isActive: true },
  { key: "S9_Q27", order: 27, tag: "AI Act Art. 73", question_en: "What is your serious incident reporting process (triggers, timelines, responsible owner, authority reporting)?", question_tr: "Ciddi olay raporlama süreciniz nedir (tetikleyiciler, süreler, sorumlu kişi, otoriteye bildirim)?", placeholder: "Describe incident reporting process…", helper: "e.g., \"Severity triggers; report within X days; owner: compliance lead.\"", isActive: true }
];

async function createBackup(db, collectionName) {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const backupName = `${collectionName}_backup_${dateStr}`;
  
  try {
    // Get source collection
    const sourceCollection = db.collection(collectionName);
    const count = await sourceCollection.countDocuments();
    
    if (count === 0) {
      console.log(`⚠️  Collection ${collectionName} is empty, skipping backup`);
      return backupName;
    }
    
    // Copy all documents to backup collection
    const backupCollection = db.collection(backupName);
    const docs = await sourceCollection.find({}).toArray();
    
    if (docs.length > 0) {
      await backupCollection.insertMany(docs);
      console.log(`✅ Created backup: ${backupName} (${docs.length} documents)`);
    } else {
      console.log(`⚠️  No documents to backup for ${collectionName}`);
    }
    
    return backupName;
  } catch (error) {
    console.error(`❌ Error creating backup for ${collectionName}:`, error.message);
    throw error;
  }
}

async function migrate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    // Step 1: Create backups
    console.log('\n📦 Step 1: Creating backups...');
    const backupQuestions = await createBackup(db, 'usecasequestions');
    const backupUseCases = await createBackup(db, 'usecases');
    console.log('✅ Backups created');

    // Step 2: Get existing questions ordered by order field
    console.log('\n📋 Step 2: Fetching existing questions...');
    const existingQuestions = await UseCaseQuestion.find().sort({ order: 1 }).lean();
    console.log(`   Found ${existingQuestions.length} existing questions`);

    // Step 3: Sort new questions by order
    const newQuestionsSorted = [...NEW_USECASE_QUESTIONS].sort((a, b) => a.order - b.order);
    console.log(`   Preparing ${newQuestionsSorted.length} new questions`);

    // Step 4: Update existing questions (preserving _id)
    console.log('\n🔄 Step 3: Updating existing questions...');
    let updatedCount = 0;
    let deactivatedCount = 0;
    let insertedCount = 0;

    // Update first N questions (where N = min(existing.length, new.length))
    const updateCount = Math.min(existingQuestions.length, newQuestionsSorted.length);
    
    for (let i = 0; i < updateCount; i++) {
      const existing = existingQuestions[i];
      const newQ = newQuestionsSorted[i];
      
      // Map new question format to existing schema format
      // IMPORTANT: Preserve existing id field to maintain answer references
      const updateDoc = {
        questionEn: newQ.question_en,
        questionTr: newQ.question_tr,
        order: newQ.order,
        key: newQ.key,
        tag: newQ.tag || '',
        placeholder: newQ.placeholder || '',
        helper: newQ.helper || '',
        isActive: newQ.isActive !== undefined ? newQ.isActive : true,
        // Preserve type and options if they exist, default to 'text'
        type: existing.type || 'text',
        options: existing.options || [],
        // Preserve existing id field (don't overwrite it)
        id: existing.id
      };

      await UseCaseQuestion.updateOne(
        { _id: existing._id },
        { $set: updateDoc }
      );
      updatedCount++;
    }

    console.log(`   ✅ Updated ${updatedCount} existing questions`);

    // Step 5: Deactivate remaining old questions (if any)
    if (existingQuestions.length > newQuestionsSorted.length) {
      const remainingOld = existingQuestions.slice(newQuestionsSorted.length);
      for (const oldQ of remainingOld) {
        await UseCaseQuestion.updateOne(
          { _id: oldQ._id },
          { $set: { isActive: false } }
        );
        deactivatedCount++;
      }
      console.log(`   ⚠️  Deactivated ${deactivatedCount} old questions (set isActive=false)`);
    }

    // Step 6: Insert new questions that don't have corresponding existing ones
    if (newQuestionsSorted.length > existingQuestions.length) {
      const newOnes = newQuestionsSorted.slice(existingQuestions.length);
      
      for (const newQ of newOnes) {
        // Create new document with key as id (for backward compatibility, we use key as id)
        const newDoc = {
          id: newQ.key, // Use key as id for compatibility
          key: newQ.key,
          questionEn: newQ.question_en,
          questionTr: newQ.question_tr,
          type: 'text', // Default to text for new questions
          options: [],
          order: newQ.order,
          tag: newQ.tag || '',
          placeholder: newQ.placeholder || '',
          helper: newQ.helper || '',
          isActive: newQ.isActive !== undefined ? newQ.isActive : true
        };

        try {
          await UseCaseQuestion.create(newDoc);
          insertedCount++;
        } catch (error) {
          // If key already exists, try to update instead
          if (error.code === 11000) {
            await UseCaseQuestion.updateOne(
              { id: newQ.key },
              { $set: newDoc }
            );
            console.log(`   ⚠️  Updated existing question with key ${newQ.key} instead of inserting`);
          } else {
            throw error;
          }
        }
      }
      
      console.log(`   ✅ Inserted ${insertedCount} new questions`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Deactivated: ${deactivatedCount}`);
    console.log(`   Inserted: ${insertedCount}`);
    console.log(`   Total active questions: ${newQuestionsSorted.length}`);

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const finalCount = await UseCaseQuestion.countDocuments({ isActive: true });
    console.log(`   Active questions in DB: ${finalCount}`);
    console.log(`   Expected: ${newQuestionsSorted.length}`);
    
    if (finalCount === newQuestionsSorted.length) {
      console.log('   ✅ Verification passed!');
    } else {
      console.log('   ⚠️  Warning: Count mismatch (this may be expected if some questions were already deactivated)');
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrate();

