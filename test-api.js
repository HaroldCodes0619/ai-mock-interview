const fs = require('fs');

async function testStart() {
  try {
    const formData = new FormData();
    formData.append('action', 'start');
    formData.append('jobTitle', 'Software Engineer');
    formData.append('persona', 'Standard Interviewer');
    
    // Create a dummy file for 'file'
    fs.writeFileSync('dummy.txt', 'This is a test resume.');
    const blob = new Blob([fs.readFileSync('dummy.txt')]);
    formData.append('file', blob, 'dummy.txt');

    console.log("Sending request to http://localhost:3000/api/chat...");
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      body: formData,
    });
    
    const text = await res.text();
    console.log("Response Status:", res.status);
    console.log("Raw Response Text:", text);
    
    try {
      const data = JSON.parse(text);
      console.log("Parsed JSON:", data);
    } catch (e) {
      console.log("Could not parse response as JSON.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (fs.existsSync('dummy.txt')) {
      fs.unlinkSync('dummy.txt');
    }
  }
}

testStart();
