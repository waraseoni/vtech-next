<?php
// Initialize variables
$hashed_password = "";
$input_text = "";
$message = "";

// Check if the form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Get the input text
    $input_text = htmlspecialchars($_POST['user_text']);

    if (!empty($input_text)) {
        // Generate the Hash using the standard PHP password_hash function (Bcrypt)
        // Note: PASSWORD_DEFAULT is the most secure method currently available in PHP
        $hashed_password = password_hash($input_text, PASSWORD_DEFAULT);
    } else {
        $message = "Kripya box mein kuch likhein.";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PHP Password Hash Generator</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f9;
            display: flex;
            justify_content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 500px;
            text-align: center;
        }
        h2 { color: #333; }
        input[type="text"] {
            width: 90%;
            padding: 12px;
            margin: 15px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
        }
        button {
            background-color: #28a745;
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
        }
        button:hover {
            background-color: #218838;
        }
        .result-box {
            margin-top: 20px;
            padding: 15px;
            background-color: #e9ecef;
            border-radius: 5px;
            word-wrap: break-word; /* Ensures long hashes don't break layout */
            border-left: 5px solid #007bff;
            text-align: left;
        }
        .label {
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
            color: #555;
        }
        .hash-output {
            font-family: monospace;
            color: #d63384;
            font-size: 14px;
        }
        .error { color: red; }
    </style>
</head>
<body>

<div class="container">
    <h2>🔐 Password Hash Generator</h2>
    
    <form method="POST" action="">
        <input type="text" name="user_text" placeholder="Apna text yahan likhein..." value="<?php echo $input_text; ?>" required>
        <br>
        <button type="submit">Generate Hash (OK)</button>
    </form>

    <?php if ($message): ?>
        <p class="error"><?php echo $message; ?></p>
    <?php endif; ?>

    <?php if ($hashed_password): ?>
        <div class="result-box">
            <span class="label">Original Text:</span>
            <span><?php echo $input_text; ?></span>
            <hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;">
            <span class="label">Generated Hash:</span>
            <span class="hash-output"><?php echo $hashed_password; ?></span>
        </div>
    <?php endif; ?>
</div>

</body>
</html>

<?php
// Initialize variables
$hashed_password = "";
$input_text = "";
$message = "";

// Check if the form is submitted
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Get the input text
    $input_text = htmlspecialchars($_POST['user_text']);

    if (!empty($input_text)) {
        // ⭐ MD5 Encryption ka upyog kiya gaya hai (Aapki pehli file ke anusar)
        $hashed_password = md5($input_text);
    } else {
        $message = "Kripya box mein kuch likhein.";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PHP MD5 Hash Generator</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f9;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            width: 100%;
            max-width: 500px;
            text-align: center;
        }
        h2 { color: #333; }
        input[type="text"] {
            width: 90%;
            padding: 12px;
            margin: 15px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
        }
        button {
            background-color: #007bff;
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
        }
        button:hover {
            background-color: #0056b3;
        }
        .result-box {
            margin-top: 20px;
            padding: 15px;
            background-color: #e9ecef;
            border-radius: 5px;
            word-wrap: break-word;
            border-left: 5px solid #007bff;
            text-align: left;
        }
        .label {
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
            color: #555;
        }
        .hash-output {
            font-family: monospace;
            color: #d63384;
            font-size: 14px;
        }
        .error { color: red; }
    </style>
</head>
<body>

<div class="container">
    <h2>🔐 MD5 Hash Generator</h2>
    
    <form method="POST" action="">
        <input type="text" name="user_text" placeholder="Apna text yahan likhein..." value="<?php echo $input_text; ?>" required>
        <br>
        <button type="submit">Generate MD5 Hash</button>
    </form>

    <?php if ($message): ?>
        <p class="error"><?php echo $message; ?></p>
    <?php endif; ?>

    <?php if ($hashed_password): ?>
        <div class="result-box">
            <span class="label">Original Text:</span>
            <span><?php echo $input_text; ?></span>
            <hr style="border: 0; border-top: 1px solid #ccc; margin: 10px 0;">
            <span class="label">Generated MD5 Hash:</span>
            <span class="hash-output"><?php echo $hashed_password; ?></span>
        </div>
    <?php endif; ?>
</div>

</body>
</html>
