const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting E2E Test...');
  const browser = await puppeteer.launch();
  
  try {
    const page = await browser.newPage();
    console.log('Opening Host Screen...');
    await page.goto('http://localhost:5173/host');
    
    await page.waitForSelector('.room-code-display');
    const code = await page.$eval('.room-code-display', el => el.textContent);
    console.log('Host Room Code:', code);
    
    console.log('Player 1 Joining...');
    const p1 = await browser.newPage();
    await p1.goto('http://localhost:5173/join/' + code);
    await p1.waitForSelector('.input-code');
    await p1.type('.input-code', 'Alice');
    await p1.click('.btn-primary');
    
    console.log('Player 2 Joining...');
    const p2 = await browser.newPage();
    await p2.goto('http://localhost:5173/join/' + code);
    await p2.waitForSelector('.input-code');
    await p2.type('.input-code', 'Bob');
    await p2.click('.btn-primary');
    
    await page.bringToFront();
    console.log('Waiting for Start Game button...');
    await page.waitForSelector('.start-btn');
    console.log('Start Game button appeared! Clicking it...');
    await page.click('.start-btn');
    
    console.log('Waiting for Category tiles...');
    await page.waitForSelector('.clickable');
    console.log('Categories appeared! Clicking the first one...');
    const clickableCats = await page.$$('.clickable');
    await clickableCats[0].click();
    
    console.log('Waiting for active word and Correct button...');
    await page.waitForSelector('.active-word');
    const word = await page.$eval('.active-word', el => el.textContent);
    console.log('Active Word:', word.trim());
    
    await page.waitForSelector('.btn-success');
    console.log('Correct button appeared! Clicking it...');
    await page.click('.btn-success');
    
    const score = await page.$eval('.score-display', el => el.textContent);
    console.log('Score updated:', score.trim());
    
    console.log('TEST PASSED SUCCESSFULLY!');
  } catch (e) {
    console.error('TEST FAILED:', e);
  } finally {
    await browser.close();
  }
})();
