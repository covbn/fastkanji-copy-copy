import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { file_url } = await req.json();
    
    if (!file_url) {
      return Response.json({ error: 'file_url is required' }, { status: 400 });
    }

    // Fetch the CSV file
    console.log('[IMPORT] Fetching CSV from:', file_url);
    const csvResponse = await fetch(file_url);
    const csvText = await csvResponse.text();
    
    // Parse CSV
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log('[IMPORT] Headers:', headers);
    console.log('[IMPORT] Total lines:', lines.length);
    
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Simple CSV parser (handles quoted fields)
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      if (values.length !== headers.length) {
        console.warn(`[IMPORT] Skipping line ${i} - column mismatch`);
        continue;
      }
      
      const record = {};
      headers.forEach((header, idx) => {
        const value = values[idx].replace(/^"|"$/g, '');
        
        // Map CSV columns to entity fields, skip metadata fields
        if (['id', 'created_date', 'updated_date', 'created_by_id', 'created_by', 'is_sample'].includes(header)) {
          return;
        }
        
        // Convert numeric fields
        if (header === 'core_index' || header === 'vocab_index') {
          record[header] = value ? parseFloat(value) : null;
        } else {
          record[header] = value || '';
        }
      });
      
      records.push(record);
    }
    
    console.log('[IMPORT] Parsed records:', records.length);
    
    // Delete existing vocabulary
    console.log('[IMPORT] Clearing existing vocabulary...');
    const existing = await base44.asServiceRole.entities.Vocabulary.list('-created_date', 10000);
    console.log('[IMPORT] Found existing records:', existing.length);
    
    for (const item of existing) {
      await base44.asServiceRole.entities.Vocabulary.delete(item.id);
    }
    console.log('[IMPORT] Cleared existing data');
    
    // Insert in batches of 100
    const batchSize = 100;
    let imported = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      console.log(`[IMPORT] Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
      
      await base44.asServiceRole.entities.Vocabulary.bulkCreate(batch);
      imported += batch.length;
    }
    
    console.log('[IMPORT] Import complete:', imported, 'records');
    
    return Response.json({ 
      success: true, 
      imported,
      message: `Successfully imported ${imported} vocabulary records` 
    });
    
  } catch (error) {
    console.error('[IMPORT] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});