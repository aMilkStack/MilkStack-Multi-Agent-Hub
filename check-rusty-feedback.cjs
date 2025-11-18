#!/usr/bin/env node

/**
 * Check Rusty's Feedback
 *
 * Fetches rusty.md from GitHub to see what Rusty found during testing.
 * Run this after Rusty commits his analysis.
 */

const https = require('https');

const owner = 'aMilkStack';
const repo = 'MilkStack-Multi-Agent-Hub';
const branch = process.argv[2] || 'main';
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const url = `https://api.github.com/repos/${owner}/${repo}/contents/rusty.md?ref=${branch}`;

const options = {
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Claude-Code-Rusty-Checker'
  }
};

if (token) {
  options.headers['Authorization'] = `Bearer ${token}`;
}

https.get(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 404) {
      console.log('📭 No rusty.md found yet. Rusty hasn\'t written his analysis.');
      console.log('   Ask Rusty to analyze the code and click "Write to rusty.md"');
      process.exit(0);
    }

    if (res.statusCode !== 200) {
      console.error(`❌ Error: ${res.statusCode} ${res.statusMessage}`);
      console.error(data);
      process.exit(1);
    }

    try {
      const json = JSON.parse(data);
      const content = Buffer.from(json.content, 'base64').toString('utf-8');

      console.log('\n' + '='.repeat(80));
      console.log('📬 RUSTY\'S FEEDBACK FROM GITHUB');
      console.log('='.repeat(80) + '\n');
      console.log(content);
      console.log('\n' + '='.repeat(80));
      console.log(`📍 File: ${owner}/${repo}/rusty.md (branch: ${branch})`);
      console.log('='.repeat(80) + '\n');
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('❌ Network error:', error.message);
  process.exit(1);
});
