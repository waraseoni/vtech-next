<?php
function html_to_image($html) {
    $html = '<html><body style="margin:20px;font-family:Arial">'.$html.'</body></html>';
    $url = "https://html2canvas.herokuapp.com/?html=" . urlencode($html);
    // Free service (temporary) – ya phir apna server bana sakte hain
    // Main aapko 100% offline wala bhi bhej sakta hoon agar chahiye
    return file_get_contents($url);
}
?>