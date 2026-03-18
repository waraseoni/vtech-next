function sendWhatsApp(job_id, client_id, phone) {
    if (!phone || phone.includes('not')) {
        alert("WhatsApp number nahi hai!");
        return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
        alert("Phone number sahi nahi hai: " + phone);
        return;
    }

    const message = `Namaste! Aapka item repair ho gaya hai. 🎉\nJob ID: ${job_id}\nTotal Bill: ₹${$('#amount_'+job_id).text()}\nJaldi se le jaiye!\n\nVikram Electronics & Repair\nWright Town, Jabalpur\nCall: 9179105875`;
    
    const pdfUrl = `pdf/bill_template.php?job_id=${job_id}&print=1`;
    
    // Pehle PDF generate karo
    fetch(pdfUrl)
    .then(() => {
        const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
        
        // Mark as sent (optional)
        $.post('ajax/send_whatsapp.php', {job_id: job_id}, function() {
            $('#wa_btn_'+job_id).html('Sent').prop('disabled', true);
        });
    });
}