<?php
// Initialize variables
$hashed_output = "";
$input_text = "";
$message = "";
$match_result = "";

// Check if the form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    
    // CASE 1: MD5 Generate Karna
    if (isset($_POST['action']) && $_POST['action'] == 'generate') {
        $input_text = htmlspecialchars($_POST['user_text']);
        if (!empty($input_text)) {
            $hashed_output = md5($input_text); //
        } else {
            $message = "Kripya Hash generate karne ke liye text likhein.";
        }
    }

    // CASE 2: MD5 Match (Decrypt Check) Karna
    if (isset($_POST['action']) && $_POST['action'] == 'decrypt') {
        $check_text = $_POST['check_text'];
        $check_hash = $_POST['check_hash'];

        if (!empty($check_text) && !empty($check_hash)) {
            // MD5 logic: Hum input text ko fir se hash karte hain aur match karte hain
            if (md5($check_text) === $check_hash) {
                $match_result = "<span style='color:green;'>✅ Match Successful! Yeh text is hash ka hi hai.</span>";
            } else {
                $match_result = "<span style='color:red;'>❌ Match Failed! Text aur Hash alag hain.</span>";
            }
        } else {
            $message = "Kripya Text aur Hash dono bharein.";
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MD5 Generator & Matcher</title>
    <style>
        body { font-family: sans-serif; background-color: #f4f4f9; padding: 20px; }
        .container { background: white; padding: 20px; border-radius: 10px; max-width: 600px; margin: auto; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h2 { border-bottom: 2px solid #eee; padding-bottom: 10px; color: #333; }
        input { width: 95%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; }
        button { padding: 10px 20px; cursor: pointer; border-radius: 5px; border: none; color: white; }
        .btn-gen { background-color: #007bff; }
        .btn-dec { background-color: #28a745; }
        .result-box { margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 5px solid #007bff; }
        .error { color: red; font-weight: bold; }
        hr { margin: 30px 0; border: 0; border-top: 1px solid #eee; }
    </style>
</head>
<body>

<div class="container">
    <h2>1. Generate MD5</h2>
    <form method="POST">
        <input type="hidden" name="action" value="generate">
        <input type="text" name="user_text" placeholder="Text likhein jiska MD5 chahiye..." value="<?php echo $input_text; ?>">
        <button type="submit" class="btn-gen">Generate Hash</button>
    </form>

    <?php if ($hashed_output): ?>
        <div class="result-box">
            <strong>Generated MD5:</strong><br>
            <code style="word-break: break-all;"><?php echo $hashed_output; ?></code>
        </div>
    <?php endif; ?>

    <hr>

    <h2>2. Match/Check MD5 (Decrypt)</h2>
    <p style="font-size: 12px; color: #666;">Note: MD5 ko seedha decrypt nahi kiya ja sakta, hum text ko match karke check karte hain.</p>
    <form method="POST">
        <input type="hidden" name="action" value="decrypt">
        <input type="text" name="check_text" placeholder="Original Text likhein...">
        <input type="text" name="check_hash" placeholder="MD5 Hash paste karein...">
        <button type="submit" class="btn-dec">Check Match</button>
    </form>

    <?php if ($match_result): ?>
        <div class="result-box" style="border-left-color: #28a745;">
            <strong>Result:</strong> <?php echo $match_result; ?>
        </div>
    <?php endif; ?>

    <?php if ($message): ?>
        <p class="error"><?php echo $message; ?></p>
    <?php endif; ?>
</div>

</body>
</html>

