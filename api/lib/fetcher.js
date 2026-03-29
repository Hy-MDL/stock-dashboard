import yahooFinance from 'yahoo-finance2/dist/esm/src/index-node.js';
import { supabase } from './supabase.js';

export async function fetchStockData(ticker, days = 90) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch daily data
    const dailyData = await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });

    // Insert daily data
    for (const row of dailyData) {
      const { error } = await supabase
        .from('daily_price')
        .upsert([{
          ticker,
          date: row.date.toISOString(),
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume
        }], {
          onConflict: 'ticker,date',
          ignoreDuplicates: true
        });

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error(`Error inserting daily price for ${ticker}:`, error);
      }
    }

    console.log(`Fetched ${dailyData.length} daily records for ${ticker}`);

  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    throw error;
  }
}

export async function updateAllStocks() {
  try {
    // Get all unique tickers from stock_selection
    const { data: selections, error } = await supabase
      .from('stock_selection')
      .select('ticker')
      .order('ticker');

    if (error) throw error;

    const uniqueTickers = [...new Set(selections.map(s => s.ticker))];

    // Always include KOSPI
    if (!uniqueTickers.includes('^KS11')) {
      uniqueTickers.push('^KS11');
    }

    console.log(`Updating ${uniqueTickers.length} stocks...`);

    for (const ticker of uniqueTickers) {
      console.log(`Fetching ${ticker}...`);
      try {
        await fetchStockData(ticker);
      } catch (error) {
        console.error(`Failed to fetch ${ticker}:`, error.message);
      }
    }

    console.log('All stocks updated successfully');
    return { success: true, count: uniqueTickers.length };

  } catch (error) {
    console.error('Error updating all stocks:', error);
    throw error;
  }
}

export async function saveRankHistory() {
  try {
    const { data: weeks } = await supabase
      .from('week')
      .select('*');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const week of weeks) {
      const { data: students } = await supabase
        .from('student')
        .select('*');

      const tempResults = [];

      for (const student of students) {
        // Skip admin and KOSPI
        if (student.name.toLowerCase().includes('_admin') || student.student_id === 'KOSPI_INDEX') {
          continue;
        }

        const { data: selection } = await supabase
          .from('stock_selection')
          .select('*')
          .eq('student_id', student.id)
          .eq('week_id', week.id)
          .single();

        if (!selection) continue;

        // Get buy price
        const { data: buyPriceRecord } = await supabase
          .from('daily_price')
          .select('*')
          .eq('ticker', selection.ticker)
          .gte('date', week.week_start)
          .order('date', { ascending: true })
          .limit(1)
          .single();

        if (!buyPriceRecord) continue;

        const buyPrice = buyPriceRecord.open;

        // Get current price
        const { data: sellPriceRecord } = await supabase
          .from('daily_price')
          .select('*')
          .eq('ticker', selection.ticker)
          .order('date', { ascending: false })
          .limit(1)
          .single();

        if (!sellPriceRecord) continue;

        const currentPrice = sellPriceRecord.close;
        const yieldPct = ((currentPrice - buyPrice) / buyPrice) * 100;

        tempResults.push({
          student_id: student.id,
          yield: yieldPct,
          current_price: currentPrice
        });
      }

      // Sort and assign ranks
      tempResults.sort((a, b) => b.yield - a.yield);

      for (let rank = 0; rank < tempResults.length; rank++) {
        const result = tempResults[rank];

        // Check if already exists
        const { data: existing } = await supabase
          .from('rank_history')
          .select('id')
          .eq('student_id', result.student_id)
          .eq('week_id', week.id)
          .eq('date', today.toISOString())
          .single();

        if (!existing) {
          await supabase
            .from('rank_history')
            .insert([{
              student_id: result.student_id,
              week_id: week.id,
              date: today.toISOString(),
              rank: rank + 1,
              yield_pct: result.yield,
              current_price: result.current_price
            }]);
        }
      }
    }

    console.log('Rank history saved successfully');
    return { success: true };

  } catch (error) {
    console.error('Error saving rank history:', error);
    throw error;
  }
}
