<?php
// Configuration based on your provided snippet
define('ENCRYPTION_KEY', '5da283a2d990e8d8512cf967df5bc0d0');
define('CIPHER_METHOD', 'AES-128-ECB');

$output = "";
$input_text = "";
$mode = "";

// Handle Form Submission
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $input_text = isset($_POST['input_text']) ? $_POST['input_text'] : '';
    $action = isset($_POST['action']) ? $_POST['action'] : '';

    if ($action === 'encrypt') {
        // Your test_cypher logic
        $output = openssl_encrypt($input_text, CIPHER_METHOD, ENCRYPTION_KEY);
        $mode = "Encrypted";
    } elseif ($action === 'decrypt') {
        // Your test_cypher_decrypt logic
        $output = openssl_decrypt($input_text, CIPHER_METHOD, ENCRYPTION_KEY);
        $mode = "Decrypted";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AES-128-ECB Tool</title>
    <style>
        body { font-family: sans-serif; background-color: #f4f4f9; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        h2 { margin-top: 0; color: #333; }
        textarea { width: 100%; height: 150px; padding: 10px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; }
        .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; color: white; font-weight: bold; font-size: 16px; margin-right: 10px; }
        .btn-encrypt { background-color: #28a745; }
        .btn-decrypt { background-color: #007bff; }
        .btn-clear { background-color: #6c757d; text-decoration: none; display:inline-block; }
        .result-box { margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 4px; border-left: 5px solid #007bff; word-wrap: break-word; }
        label { font-weight: bold; display: block; margin-bottom: 5px; }
    </style>
</head>
<body>

<div class="container">
    <h2>PHP AES-128-ECB Tool</h2>
    <p>Using Key: <code><?php echo ENCRYPTION_KEY; ?></code></p>

    <form method="post">
        <label for="input_text">Input Data:</label>
        <textarea name="input_text" id="input_text" placeholder="Paste text here..."><?php echo htmlspecialchars($input_text); ?></textarea>
        
        <br>
        <button type="submit" name="action" value="encrypt" class="btn btn-encrypt">Encrypt</button>
        <button type="submit" name="action" value="decrypt" class="btn btn-decrypt">Decrypt</button>
        <a href="" class="btn btn-clear">Clear</a>
    </form>

    <?php if ($output !== ""): ?>
        <div class="result-box">
            <h3>Result (<?php echo $mode; ?>):</h3>
            <pre><?php echo htmlspecialchars($output); ?></pre>
        </div>
    <?php endif; ?>
</div>

</body>
</html>