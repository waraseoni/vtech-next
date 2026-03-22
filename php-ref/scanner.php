<?php
/**
 * Ultimate Project Auditor: Duplicate, Unused & Dependency Scanner
 */

// --- CONFIGURATION ---
$ignore = ['.git', 'vendor', 'uploads', 'assets', 'temp', 'node_modules'];
$extensions = ['php', 'js', 'html', 'css'];

// --- DELETE LOGIC ---
$del_msg = "";
if (isset($_POST['delete_files']) && !empty($_POST['selected_files'])) {
    $count = 0;
    foreach ($_POST['selected_files'] as $f) {
        $path = realpath(__DIR__ . DIRECTORY_SEPARATOR . $f);
        if ($path && strpos($path, realpath(__DIR__)) === 0 && file_exists($path)) {
            if (unlink($path)) $count++;
        }
    }
    $del_msg = "<div class='alert success'>Successfully deleted $count files!</div>";
}

// --- SCANNING LOGIC ---
function getAllFiles($dir, &$results, $ignore) {
    $files = scandir($dir);
    foreach ($files as $f) {
        if ($f == '.' || $f == '..' || in_array($f, $ignore)) continue;
        $path = $dir . DIRECTORY_SEPARATOR . $f;
        if (is_dir($path)) getAllFiles($path, $results, $ignore);
        else {
            $ext = pathinfo($path, PATHINFO_EXTENSION);
            if (in_array($ext, ['php', 'js', 'html', 'css'])) {
                $results[] = str_replace(realpath(__DIR__) . DIRECTORY_SEPARATOR, '', realpath($path));
            }
        }
    }
}

$all_files = [];
getAllFiles(__DIR__, $all_files, $ignore);
$all_files = array_filter($all_files, function($f) { return $f !== basename(__FILE__); });

$map = [];
$unused = [];
$duplicates = [];
$file_hashes = [];

// Hash checking for duplicates
foreach ($all_files as $file) {
    $content = file_get_contents(__DIR__ . DIRECTORY_SEPARATOR . $file);
    
    // Duplicate check using MD5 Hash
    $hash = md5($content);
    if (isset($file_hashes[$hash])) {
        $duplicates[] = ['original' => $file_hashes[$hash], 'duplicate' => $file];
    } else {
        $file_hashes[$hash] = $file;
    }

    // Dependency mapping
    foreach ($all_files as $target) {
        if ($file == $target) continue;
        if (strpos($content, basename($target)) !== false) {
            $map[$file][] = $target;
        }
    }
}

// Unused discovery
foreach ($all_files as $file) {
    $is_used = false;
    foreach ($map as $parent => $children) {
        if (in_array($file, $children)) { $is_used = true; break; }
    }
    // index.php is always active
    if (!$is_used && basename($file) !== 'index.php') $unused[] = $file;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <title>Ultimate Project Auditor</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #f4f7f9; padding: 20px; color: #333; }
        .container { max-width: 1100px; margin: auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 5px 25px rgba(0,0,0,0.1); }
        .section { margin-bottom: 40px; border: 1px solid #eee; padding: 20px; border-radius: 8px; }
        h2 { color: #1a73e8; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
        .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .file-row { display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #f9f9f9; }
        .file-row:hover { background: #fcfcfc; }
        .duplicate-item { color: #d93025; font-weight: bold; }
        .dependency-list { font-size: 0.85em; color: #666; margin-left: 25px; }
        .btn-del { background: #d93025; color: white; border: none; padding: 12px 25px; border-radius: 5px; cursor: pointer; font-weight: bold; }
        .btn-del:disabled { background: #ccc; }
        .badge { font-size: 0.7em; padding: 2px 8px; border-radius: 10px; margin-left: 10px; vertical-align: middle; }
        .badge-danger { background: #fce8e6; color: #d93025; }
        .badge-info { background: #e8f0fe; color: #1967d2; }
    </style>
</head>
<body>

<div class="container">
    <h2>Project Master Auditor</h2>
    <?= $del_msg ?>

    

    <form method="POST">
        <div class="section">
            <h3>1. Duplicate Files (Renamed or Identical Content)</h3>
            <?php if(empty($duplicates)): ?> <p>Koi duplicate files nahi mili.</p> <?php else: ?>
                <?php foreach($duplicates as $dup): ?>
                    <div class="file-row">
                        <input type="checkbox" name="selected_files[]" value="<?= $dup['duplicate'] ?>">
                        <span style="margin-left: 10px;">
                            <span class="duplicate-item"><?= $dup['duplicate'] ?></span> 
                            <small class="text-muted">is a copy of</small> 
                            <strong><?= $dup['original'] ?></strong>
                        </span>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <div class="section">
            <h3>2. Isolated Files (Not referenced anywhere)</h3>
            <?php if(empty($unused)): ?> <p>Sabhi files active hain!</p> <?php else: ?>
                <?php foreach($unused as $u): ?>
                    <div class="file-row">
                        <input type="checkbox" name="selected_files[]" value="<?= $u ?>">
                        <span style="margin-left: 10px;"><?= $u ?> <span class="badge badge-danger">Unused</span></span>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>

        <div class="section">
            <h3>3. Dependency Map (Quick View)</h3>
            <div style="max-height: 300px; overflow-y: auto;">
                <?php foreach($map as $parent => $children): ?>
                    <div style="margin-bottom: 10px;">
                        <strong><?= $parent ?></strong> <span class="badge badge-info"><?= count($children) ?> Links</span>
                        <div class="dependency-list">Uses: <?= implode(', ', $children) ?></div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <p><input type="checkbox" id="confirm" onchange="document.getElementById('delBtn').disabled = !this.checked"> I understand that deleting files is permanent. (Backup Recommended)</p>
            <button type="submit" name="delete_files" id="delBtn" class="btn-del" disabled>Delete Selected Files</button>
        </div>
    </form>
</div>

</body>
</html>