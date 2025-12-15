/**
 * Check responses collection for ethical and medical expert responses
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(MONGO_URI);

const Response = require('../models/response');

async function checkResponses() {
  try {
    console.log('📊 Responses Collection Analysis\n');
    
    // Check all responses by role and questionnaire
    const allResponses = await Response.find({})
      .select('role questionnaireKey status answers createdAt')
      .lean();
    
    console.log(`Total responses: ${allResponses.length}\n`);
    
    // Group by role and questionnaire
    const grouped = {};
    allResponses.forEach(r => {
      const key = `${r.role}-${r.questionnaireKey}`;
      if (!grouped[key]) {
        grouped[key] = {
          role: r.role,
          questionnaireKey: r.questionnaireKey,
          count: 0,
          statuses: {},
          answerCounts: []
        };
      }
      grouped[key].count++;
      grouped[key].statuses[r.status] = (grouped[key].statuses[r.status] || 0) + 1;
      grouped[key].answerCounts.push(r.answers?.length || 0);
    });
    
    // Print grouped results
    Object.keys(grouped).sort().forEach(key => {
      const g = grouped[key];
      console.log(`${g.role} - ${g.questionnaireKey}:`);
      console.log(`  Count: ${g.count}`);
      console.log(`  Statuses: ${JSON.stringify(g.statuses)}`);
      console.log(`  Answer counts: ${g.answerCounts.join(', ')}`);
      console.log('');
    });
    
    // Check specifically for ethical expert
    console.log('\n🔍 Ethical Expert Responses:');
    const ethicalResponses = await Response.find({ role: 'ethical-expert' })
      .select('questionnaireKey status answers createdAt')
      .sort({ createdAt: -1 })
      .lean();
    
    if (ethicalResponses.length === 0) {
      console.log('  ⚠️  No ethical expert responses found');
    } else {
      ethicalResponses.forEach(r => {
        console.log(`  ${r.questionnaireKey}: ${r.status} (${r.answers?.length || 0} answers, created: ${r.createdAt})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkResponses();



