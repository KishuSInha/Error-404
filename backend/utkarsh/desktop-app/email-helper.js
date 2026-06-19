async function summarizeEmails() {
    try {
        console.log('📧 Fetching email digest...');
        const digest = await window.electronAPI.getEmailDigest();

        if (digest.error) {
            console.error('❌ Error:', digest.error);
            return;
        }

        console.log('\n📊 Email Digest:');
        console.log('================');
        console.log(digest.summary);
        console.log('\n📈 Total Emails:', digest.totalEmails);

        if (digest.needsReply && digest.needsReply.length > 0) {
            console.log('\n⚠️ Emails Needing Reply:');
            digest.needsReply.forEach((email, index) => {
                console.log(`${index + 1}. ${email.subject}`);
                console.log(`   From: ${email.app || 'Unknown'}`);
                console.log(`   Time: ${new Date(email.timestamp * 1000).toLocaleString()}`);
            });
        } else {
            console.log('\n✅ No emails need replies');
        }

        return digest;
    } catch (error) {
        console.error('❌ Failed to get email digest:', error);
    }
}

async function startEmailMonitoring() {
    console.log('🚀 Starting email monitoring...');
    window.electronAPI.startMonitoring();
    console.log('✅ Monitoring started! Open your email app and the system will capture it.');
    console.log('💡 Wait 1-2 minutes, then run: summarizeEmails()');
}


console.log('📧 Email Summarizer Helper Loaded!');
console.log('Run: startEmailMonitoring() to begin');
