<?php 
// Unified parameter handling
$search_param = null;
$search_type = null;

if(isset($_GET['job_id'])) {
    $search_param = $_GET['job_id'];
    $search_type = 'job_id';
    $qry = $conn->query("SELECT r.*, CONCAT(c.firstname, ', ', COALESCE(c.middlename, ''), ' ', c.lastname) as client, 
                          c.contact, c.address 
                         FROM `transaction_list` r 
                         INNER JOIN client_list c ON r.client_name = c.id 
                         WHERE r.job_id = '{$search_param}'");
} elseif(isset($_GET['code'])) {
    $search_param = $_GET['code'];
    $search_type = 'code';
    $qry = $conn->query("SELECT r.*, CONCAT(c.firstname, ' ', COALESCE(c.middlename, ' '), ' ', c.lastname) as client,
                         c.contact, c.address 
                         FROM `transaction_list` r 
                         INNER JOIN client_list c ON r.client_name = c.id 
                         WHERE r.code = '{$search_param}'");
} else {
    echo "<script>
            Swal.fire({
                title: 'Invalid Request',
                text: 'Please provide Job ID or Repair Code',
                icon: 'error',
                confirmButtonText: 'Go Back'
            }).then(() => {
                location.replace('./?p=check_status');
            });
          </script>";
    exit;
}

if($qry->num_rows > 0) {
    $res = $qry->fetch_array();
    foreach($res as $k => $v) {
        if(!is_numeric($k)) {
            $$k = $v;
        }
    }
    
    // Get services
    $services_qry = $conn->query("SELECT ts.*, s.name as service_name 
                                  FROM transaction_services ts 
                                  INNER JOIN service_list s ON ts.service_id = s.id 
                                  WHERE ts.transaction_id = '$id'");
    $services = [];
    $total_services = 0;
    while($row = $services_qry->fetch_assoc()) {
        $services[] = $row;
        $total_services += $row['price'];
    }
    
    // Get products
    $products_qry = $conn->query("SELECT tp.*, p.name as product_name 
                                  FROM transaction_products tp 
                                  INNER JOIN product_list p ON tp.product_id = p.id 
                                  WHERE tp.transaction_id = '$id'");
    $products = [];
    $total_products = 0;
    while($row = $products_qry->fetch_assoc()) {
        $row_total = $row['qty'] * $row['price'];
        $row['total'] = $row_total;
        $products[] = $row;
        $total_products += $row_total;
    }
    
    // Status configuration
    $status_config = [
        0 => ["Pending", "Kaam shuru nahi hua hai", "warning", "fa-clock", "#f59e0b", "rgb(245, 158, 11, 0.2)"],
        1 => ["On-Progress", "Kaam chal raha hai", "primary", "fa-spinner fa-spin", "#667eea", "rgba(102, 126, 234, 0.2)"],
        2 => ["Done", "Kaam pura ho gaya hai", "info", "fa-check-circle", "#3b82f6", "rgba(59, 130, 246, 0.2)"],
        3 => ["Paid", "Payment ho chuka hai", "success", "fa-rupee-sign", "#10b981", "rgba(16, 185, 129, 0.2)"],
        4 => ["Cancelled", "Transaction radd ho gaya", "danger", "fa-times-circle", "#ef4444", "rgba(239, 68, 68, 0.2)"],
        5 => ["Delivered", "Aapko item mil chuka hai", "success", "fa-truck", "#059669", "rgba(5, 150, 105, 0.2)"]
    ];
    
    $current_status = $status_config[$status] ?? ["Unknown", "Status unknown", "secondary", "fa-question-circle", "#6b7280", "rgba(107, 114, 128, 0.2)"];
    list($status_label, $status_hindi, $status_class, $status_icon, $status_color, $status_bg) = $current_status;
    
} else {
    echo "<script>
            Swal.fire({
                title: 'Not Found',
                html: '<div style=\"background: rgba(239, 68, 68, 0.1); padding: 1rem; border-radius: 10px; margin: 1rem 0;\">" .
                      "<i class=\"fa fa-search fa-2x mb-3\" style=\"color: #ef4444;\"></i>" .
                      "<h5 style=\"color: #fca5a5;\">Invalid $search_type</h5>" .
                      "<p style=\"color: #fecaca;\">The $search_type <strong>$search_param</strong> was not found in our system.</p>" .
                      "</div>',
                icon: 'error',
                confirmButtonText: 'Try Again',
                backdrop: 'rgba(0, 0, 0, 0.8)'
            }).then(() => {
                location.replace('./?p=check_status');
            });
          </script>";
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Status - <?= $job_id ?> (<?= $code ?>)</title>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
<style>
    :root {
        --bg-primary: #0a0a12;
        --bg-secondary: #1a1a2e;
        --bg-card: #16162a;
        --accent-primary: #667eea;
        --accent-secondary: #764ba2;
        --accent-success: #10b981;
        --accent-warning: #f59e0b;
        --accent-danger: #ef4444;
        --accent-info: #3b82f6;
        --text-primary: #ffffff;
        --text-secondary: #b0b0c0;
        --text-muted: #6c757d;
        --border-color: #2a2a3e;
        --glow-primary: rgba(102, 126, 234, 0.3);
        --glow-success: rgba(16, 185, 129, 0.3);
    }

    body {
        background: linear-gradient(135deg, 
            #0a0a12 0%, 
            #1a1a2e 25%, 
            #2d1b69 50%, 
            #1a1a2e 75%, 
            #0a0a12 100%);
        background-size: 400% 400%;
        animation: gradientShift 20s ease infinite;
        min-height: 100vh;
        color: var(--text-primary);
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    }

    @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }

    /* Animated background elements */
    .bg-particle {
        position: fixed;
        border-radius: 50%;
        background: radial-gradient(circle, var(--accent-primary) 0%, transparent 70%);
        animation: floatParticle 20s infinite linear;
        z-index: -1;
        opacity: 0.05;
    }

    @keyframes floatParticle {
        0% { transform: translate(0, 0) rotate(0deg); }
        100% { transform: translate(100px, 100px) rotate(360deg); }
    }

    .content {
        position: relative;
        z-index: 1;
        padding: 2rem 0;
    }

    /* Status Overview Card */
    .status-overview {
        background: linear-gradient(135deg, 
            rgba(22, 22, 42, 0.9) 0%, 
            rgba(26, 26, 46, 0.9) 100%);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 25px;
        box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 100px var(--glow-primary),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        overflow: hidden;
        margin-bottom: 2rem;
        transition: all 0.5s ease;
        position: relative;
    }

    .status-overview:hover {
        transform: translateY(-5px);
        box-shadow: 
            0 30px 80px rgba(0, 0, 0, 0.6),
            0 0 150px var(--glow-primary),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .status-overview::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, 
            var(--accent-primary), 
            var(--accent-secondary),
            var(--accent-primary));
        background-size: 200% 100%;
        animation: shimmer 3s infinite linear;
    }

    @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
    }

    .status-header {
        padding: 2rem;
        background: linear-gradient(135deg, 
            rgba(102, 126, 234, 0.1) 0%, 
            rgba(118, 75, 162, 0.1) 100%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: <?= $status_bg ?>;
        border: 2px solid <?= $status_color ?>;
        color: <?= $status_color ?>;
        padding: 0.8rem 1.5rem;
        border-radius: 50px;
        font-weight: 700;
        font-size: 1.1rem;
        box-shadow: 0 10px 30px <?= str_replace('0.2', '0.3', $status_bg) ?>;
        transition: all 0.3s ease;
        cursor: pointer;
    }

    .status-badge:hover {
        transform: scale(1.05);
        box-shadow: 0 15px 40px <?= str_replace('0.2', '0.4', $status_bg) ?>;
    }

    .status-badge i {
        font-size: 1.2rem;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }

    /* Client Info Card */
    .client-card {
        background: rgba(22, 22, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 20px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        transition: all 0.3s ease;
    }

    .client-card:hover {
        border-color: var(--accent-primary);
        transform: translateY(-3px);
        box-shadow: 0 15px 40px rgba(102, 126, 234, 0.2);
    }

    .client-avatar {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        color: white;
        font-weight: 700;
        margin-right: 1.5rem;
        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
    }

    /* Information Grid */
    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
        margin: 2rem 0;
    }

    .info-card {
        background: rgba(26, 26, 46, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 15px;
        padding: 1.5rem;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    }

    .info-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--accent-primary), transparent);
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .info-card:hover {
        border-color: var(--accent-primary);
        transform: translateY(-5px);
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
    }

    .info-card:hover::before {
        opacity: 1;
    }

    .info-label {
        color: var(--text-muted);
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .info-value {
        color: var(--text-primary);
        font-size: 1.2rem;
        font-weight: 600;
        word-break: break-word;
    }

    /* Services & Products Tables */
    .service-table, .product-table {
        background: rgba(22, 22, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 15px;
        overflow: hidden;
        margin-bottom: 2rem;
        transition: all 0.3s ease;
    }

    .service-table:hover, .product-table:hover {
        border-color: var(--accent-primary);
        box-shadow: 0 15px 40px rgba(102, 126, 234, 0.1);
    }

    .table-header {
        background: linear-gradient(135deg, 
            rgba(102, 126, 234, 0.1) 0%, 
            rgba(118, 75, 162, 0.1) 100%);
        padding: 1.2rem 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .table-header i {
        color: var(--accent-primary);
        font-size: 1.2rem;
    }

    .table-body {
        padding: 0;
    }

    .table-row {
        display: flex;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        transition: all 0.3s ease;
    }

    .table-row:hover {
        background: rgba(102, 126, 234, 0.05);
        transform: translateX(5px);
    }

    .table-row:last-child {
        border-bottom: none;
    }

    /* Amount Summary */
    .amount-summary {
        background: linear-gradient(135deg, 
            rgba(16, 185, 129, 0.1) 0%, 
            rgba(5, 150, 105, 0.1) 100%);
        border: 2px solid var(--accent-success);
        border-radius: 20px;
        padding: 2rem;
        margin: 2rem 0;
        text-align: center;
        position: relative;
        overflow: hidden;
    }

    .amount-summary::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: linear-gradient(45deg, 
            transparent 30%, 
            rgba(255, 255, 255, 0.1) 50%, 
            transparent 70%);
        transform: rotate(45deg);
        animation: shine 3s infinite linear;
    }

    @keyframes shine {
        0% { transform: translateX(-100%) rotate(45deg); }
        100% { transform: translateX(100%) rotate(45deg); }
    }

    .total-amount {
        font-size: 3.5rem;
        font-weight: 800;
        background: linear-gradient(45deg, #10b981, #34d399);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 5px 15px rgba(16, 185, 129, 0.3);
        margin: 1rem 0;
    }

    /* Tabs for switching views */
    .view-tabs {
        display: flex;
        gap: 1rem;
        margin-bottom: 2rem;
        padding: 1rem;
        background: rgba(22, 22, 42, 0.5);
        border-radius: 15px;
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .tab-btn {
        flex: 1;
        background: rgba(26, 26, 46, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1rem;
        color: var(--text-secondary);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    .tab-btn:hover {
        background: rgba(102, 126, 234, 0.1);
        color: var(--text-primary);
        transform: translateY(-3px);
    }

    .tab-btn.active {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        color: white;
        border-color: var(--accent-primary);
        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    }

    /* View containers */
    .view-container {
        display: none;
        animation: fadeIn 0.5s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .view-container.active {
        display: block;
    }

    /* Compact View */
    .compact-view .info-grid {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }

    .compact-view .info-card {
        padding: 1rem;
    }

    .compact-view .service-table,
    .compact-view .product-table {
        margin-bottom: 1rem;
    }

    /* Timeline */
    .timeline {
        position: relative;
        padding-left: 30px;
        margin: 2rem 0;
    }

    .timeline::before {
        content: '';
        position: absolute;
        left: 15px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: linear-gradient(180deg, var(--accent-primary), transparent);
    }

    .timeline-item {
        position: relative;
        margin-bottom: 1.5rem;
    }

    .timeline-item::before {
        content: '';
        position: absolute;
        left: -23px;
        top: 5px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--accent-primary);
        box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
    }

    .timeline-item.completed::before {
        background: var(--accent-success);
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
    }

    .timeline-item.current::before {
        animation: pulse 2s infinite;
        box-shadow: 0 0 0 8px rgba(102, 126, 234, 0.3);
    }

    /* Action Buttons */
    .action-buttons {
        display: flex;
        gap: 1rem;
        margin-top: 2rem;
        flex-wrap: wrap;
    }

    .action-btn {
        flex: 1;
        min-width: 150px;
        background: rgba(26, 26, 46, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 15px;
        padding: 1rem;
        color: var(--text-primary);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        text-decoration: none;
    }

    .action-btn:hover {
        transform: translateY(-5px);
        text-decoration: none;
        color: var(--text-primary);
    }

    .action-btn.back {
        background: linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(75, 85, 99, 0.1));
        border-color: rgba(107, 114, 128, 0.3);
    }

    .action-btn.back:hover {
        background: linear-gradient(135deg, rgba(107, 114, 128, 0.2), rgba(75, 85, 99, 0.2));
        box-shadow: 0 10px 30px rgba(107, 114, 128, 0.2);
    }

    .action-btn.print {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1));
        border-color: rgba(59, 130, 246, 0.3);
    }

    .action-btn.print:hover {
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2));
        box-shadow: 0 10px 30px rgba(59, 130, 246, 0.2);
    }

    .action-btn.share {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1));
        border-color: rgba(16, 185, 129, 0.3);
    }

    .action-btn.share:hover {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2));
        box-shadow: 0 10px 30px rgba(16, 185, 129, 0.2);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .content {
            padding: 1rem 0;
        }
        
        .info-grid {
            grid-template-columns: 1fr;
        }
        
        .table-row {
            flex-direction: column;
            gap: 0.5rem;
            text-align: center;
        }
        
        .total-amount {
            font-size: 2.5rem;
        }
        
        .view-tabs {
            flex-direction: column;
        }
        
        .action-buttons {
            flex-direction: column;
        }
        
        .action-btn {
            width: 100%;
        }
    }

    /* Custom scrollbar */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    ::-webkit-scrollbar-track {
        background: var(--bg-secondary);
        border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
        border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, var(--accent-secondary), var(--accent-primary));
    }

    /* Print styles */
    @media print {
        body {
            background: white !important;
            color: black !important;
        }
        
        .action-buttons,
        .view-tabs {
            display: none !important;
        }
        
        .status-overview {
            box-shadow: none !important;
            border: 1px solid #ccc !important;
        }
    }
</style>

<div class="content">
    <div class="container-fluid">
        <!-- Background Particles -->
        <?php for($i = 0; $i < 20; $i++): ?>
        <div class="bg-particle" style="
            width: <?= rand(50, 200) ?>px;
            height: <?= rand(50, 200) ?>px;
            top: <?= rand(0, 100) ?>%;
            left: <?= rand(0, 100) ?>%;
            animation-delay: -<?= rand(0, 20) ?>s;
        "></div>
        <?php endfor; ?>

        <!-- Status Overview -->
        <div class="status-overview">
            <div class="status-header">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h2 class="mb-2" style="color: var(--text-primary);">
                            <i class="fa fa-receipt mr-2"></i>
                            Job Status Tracker
                        </h2>
                        <p class="text-muted mb-0">
                            <i class="fa fa-user mr-2"></i>
                            Welcome, <?= ucwords($client) ?>
                            <span class="mx-3">|</span>
                            <i class="fa fa-phone mr-2"></i>
                            <?= $contact ?>
                        </p>
                    </div>
                    <div class="col-md-4 text-md-right mt-3 mt-md-0">
                        <div class="status-badge" onclick="showStatusDetails()">
                            <i class="<?= $status_icon ?>"></i>
                            <span><?= $status_label ?></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- View Tabs -->
            <div class="view-tabs">
                <button class="tab-btn active" data-view="detailed">
                    <i class="fa fa-list-alt"></i>
                    Detailed View
                </button>
                <button class="tab-btn" data-view="compact">
                    <i class="fa fa-compress"></i>
                    Compact View
                </button>
                <button class="tab-btn" data-view="timeline">
                    <i class="fa fa-stream"></i>
                    Timeline
                </button>
            </div>

            <div class="p-4">
                <!-- Detailed View -->
                <div id="detailedView" class="view-container active">
                    <!-- Job Information Grid -->
                    <div class="info-grid">
                        <div class="info-card">
                            <div class="info-label">
                                <i class="fa fa-hashtag"></i>
                                Job Number
                            </div>
                            <div class="info-value"><?= $job_id ?></div>
                        </div>
                        
                        <div class="info-card">
                            <div class="info-label">
                                <i class="fa fa-code"></i>
                                Repair Code
                            </div>
                            <div class="info-value"><?= $code ?></div>
                        </div>
                        
                        <div class="info-card">
                            <div class="info-label">
                                <i class="fa fa-box"></i>
                                Item
                            </div>
                            <div class="info-value"><?= ucwords($item) ?></div>
                        </div>
                        
                        <div class="info-card">
                            <div class="info-label">
                                <i class="fa fa-exclamation-triangle"></i>
                                Fault Description
                            </div>
                            <div class="info-value"><?= ucwords($fault) ?></div>
                        </div>
                    </div>

                    <!-- Services & Products -->
                    <div class="row">
                        <?php if(!empty($services)): ?>
                        <div class="col-md-6">
                            <div class="service-table">
                                <div class="table-header">
                                    <i class="fa fa-wrench"></i>
                                    <h5 class="mb-0">Services Provided</h5>
                                </div>
                                <div class="table-body">
                                    <?php foreach($services as $service): ?>
                                    <div class="table-row">
                                        <div class="flex-grow-1">
                                            <div class="font-weight-bold"><?= $service['service_name'] ?></div>
                                        </div>
                                        <div class="text-right font-weight-bold" style="color: var(--accent-primary);">
                                            ₹<?= number_format($service['price'], 2) ?>
                                        </div>
                                    </div>
                                    <?php endforeach; ?>
                                    <div class="table-row" style="background: rgba(102, 126, 234, 0.05);">
                                        <div class="flex-grow-1 font-weight-bold">Total Services</div>
                                        <div class="text-right font-weight-bold" style="color: var(--accent-primary);">
                                            ₹<?= number_format($total_services, 2) ?>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <?php endif; ?>

                        <?php if(!empty($products)): ?>
                        <div class="col-md-6">
                            <div class="product-table">
                                <div class="table-header">
                                    <i class="fa fa-box-open"></i>
                                    <h5 class="mb-0">Products Used</h5>
                                </div>
                                <div class="table-body">
                                    <?php foreach($products as $product): ?>
                                    <div class="table-row">
                                        <div class="flex-grow-1">
                                            <div class="font-weight-bold"><?= $product['product_name'] ?></div>
                                            <small class="text-muted">Qty: <?= $product['qty'] ?></small>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-weight-bold" style="color: var(--accent-success);">
                                                ₹<?= number_format($product['price'], 2) ?>
                                            </div>
                                            <small class="text-muted">Total: ₹<?= number_format($product['total'], 2) ?></small>
                                        </div>
                                    </div>
                                    <?php endforeach; ?>
                                    <div class="table-row" style="background: rgba(16, 185, 129, 0.05);">
                                        <div class="flex-grow-1 font-weight-bold">Total Products</div>
                                        <div class="text-right font-weight-bold" style="color: var(--accent-success);">
                                            ₹<?= number_format($total_products, 2) ?>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <?php endif; ?>
                    </div>

                    <!-- Amount Summary -->
                    <div class="amount-summary">
                        <h4 class="text-muted mb-0">Total Payable Amount</h4>
                        <div class="total-amount">₹<?= number_format($amount, 2) ?></div>
                        <p class="text-muted mb-0">
                            <small>Includes all services and products</small>
                        </p>
                    </div>

                    <!-- Remarks -->
                    <?php if(!empty($remark)): ?>
                    <div class="info-card">
                        <div class="info-label">
                            <i class="fa fa-comment-alt"></i>
                            Additional Remarks
                        </div>
                        <div class="info-value" style="white-space: pre-wrap; line-height: 1.8;">
                            <?= nl2br(htmlspecialchars($remark)) ?>
                        </div>
                    </div>
                    <?php endif; ?>
                </div>

                <!-- Compact View -->
                <div id="compactView" class="view-container compact-view">
                    <div class="row">
                        <div class="col-md-8">
                            <div class="info-grid">
                                <div class="info-card">
                                    <div class="info-label">Job Number</div>
                                    <div class="info-value"><?= $job_id ?></div>
                                </div>
                                <div class="info-card">
                                    <div class="info-label">Repair Code</div>
                                    <div class="info-value"><?= $code ?></div>
                                </div>
                                <div class="info-card">
                                    <div class="info-label">Item</div>
                                    <div class="info-value"><?= ucwords($item) ?></div>
                                </div>
                                <div class="info-card">
                                    <div class="info-label">Fault</div>
                                    <div class="info-value"><?= ucwords($fault) ?></div>
                                </div>
                            </div>

                            <?php if(!empty($services)): ?>
                            <div class="service-table">
                                <div class="table-header">
                                    <i class="fa fa-wrench"></i>
                                    <h6 class="mb-0">Services</h6>
                                </div>
                                <div class="table-body">
                                    <?php foreach($services as $service): ?>
                                    <div class="table-row">
                                        <div><?= $service['service_name'] ?></div>
                                        <div class="text-right" style="color: var(--accent-primary);">
                                            ₹<?= number_format($service['price'], 2) ?>
                                        </div>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                            <?php endif; ?>

                            <?php if(!empty($products)): ?>
                            <div class="product-table">
                                <div class="table-header">
                                    <i class="fa fa-box-open"></i>
                                    <h6 class="mb-0">Products</h6>
                                </div>
                                <div class="table-body">
                                    <?php foreach($products as $product): ?>
                                    <div class="table-row">
                                        <div><?= $product['product_name'] ?></div>
                                        <div class="text-center"><?= $product['qty'] ?></div>
                                        <div class="text-right" style="color: var(--accent-success);">
                                            ₹<?= number_format($product['total'], 2) ?>
                                        </div>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                            <?php endif; ?>
                        </div>
                        <div class="col-md-4">
                            <div class="info-card" style="text-align: center; background: <?= $status_bg ?>; border-color: <?= $status_color ?>;">
                                <div class="info-label" style="color: <?= $status_color ?>;">
                                    <i class="<?= $status_icon ?>"></i>
                                    Current Status
                                </div>
                                <div class="info-value" style="color: <?= $status_color ?>; font-size: 1.5rem;">
                                    <?= $status_label ?>
                                </div>
                                <p class="mt-2 mb-0" style="color: <?= $status_color ?>; opacity: 0.9;">
                                    <small><?= $status_hindi ?></small>
                                </p>
                            </div>
                            
                            <div class="info-card mt-3" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1)); border-color: var(--accent-success);">
                                <div class="info-label" style="color: var(--accent-success);">
                                    Total Amount
                                </div>
                                <div class="info-value" style="color: var(--accent-success); font-size: 2rem;">
                                    ₹<?= number_format($amount, 2) ?>
                                </div>
                            </div>
                            
                            <?php if(!empty($remark)): ?>
                            <div class="info-card mt-3">
                                <div class="info-label">
                                    <i class="fa fa-sticky-note"></i>
                                    Note
                                </div>
                                <div class="info-value" style="font-size: 0.9rem;">
                                    <?= nl2br(substr(htmlspecialchars($remark), 0, 150)) ?>
                                    <?= strlen($remark) > 150 ? '...' : '' ?>
                                </div>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>

                <!-- Timeline View -->
                <div id="timelineView" class="view-container">
                    <div class="timeline">
                        <?php 
                        $status_steps = [
                            0 => ['Pending', 'Job received and queued'],
                            1 => ['On-Progress', 'Technician assigned and working'],
                            2 => ['Done', 'Repair completed successfully'],
                            3 => ['Paid', 'Payment received'],
                            5 => ['Delivered', 'Item delivered to customer']
                        ];
                        
                        foreach($status_steps as $step => $step_data):
                            $is_completed = $step < $status;
                            $is_current = $step == $status;
                            $step_class = $is_current ? 'current' : ($is_completed ? 'completed' : '');
                        ?>
                        <div class="timeline-item <?= $step_class ?>">
                            <div class="d-flex align-items-center mb-1">
                                <div style="
                                    width: 20px;
                                    height: 20px;
                                    border-radius: 50%;
                                    background: <?= $is_completed ? 'var(--accent-success)' : ($is_current ? $status_color : 'var(--text-muted)') ?>;
                                    margin-right: 10px;
                                    border: 2px solid <?= $is_current ? 'rgba(255, 255, 255, 0.3)' : 'transparent' ?>;
                                    <?= $is_current ? 'animation: pulse 2s infinite;' : '' ?>
                                "></div>
                                <h6 class="mb-0" style="color: <?= $is_completed ? 'var(--accent-success)' : ($is_current ? $status_color : 'var(--text-secondary)') ?>;">
                                    <?= $step_data[0] ?>
                                </h6>
                            </div>
                            <p class="ml-7 text-muted mb-0">
                                <?= $step_data[1] ?>
                                <?php if($is_current): ?>
                                <br>
                                <small class="text-primary">Current Status</small>
                                <?php elseif($is_completed): ?>
                                <br>
                                <small class="text-success">
                                    <i class="fa fa-check"></i> Completed
                                </small>
                                <?php endif; ?>
                            </p>
                        </div>
                        <?php endforeach; ?>
                    </div>
                    
                    <div class="text-center mt-4">
                        <div class="status-badge" onclick="showStatusDetails()">
                            <i class="<?= $status_icon ?>"></i>
                            <span>Current: <?= $status_label ?></span>
                        </div>
                        <p class="mt-2 text-muted">
                            <small><?= $status_hindi ?></small>
                        </p>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="action-buttons">
                    <a href="./?p=check_status" class="action-btn back">
                        <i class="fa fa-arrow-left"></i>
                        Back to Search
                    </a>
                    <button class="action-btn print" onclick="printJobDetails()">
                        <i class="fa fa-print"></i>
                        Print Details
                    </button>
                    <button class="action-btn share" onclick="shareJobStatus()">
                        <i class="fa fa-share-alt"></i>
                        Share Status
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- JavaScript for Interactive Features -->
<script>
// Initialize particles
document.addEventListener('DOMContentLoaded', function() {
    // Create additional particles
    for(let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'bg-particle';
        particle.style.cssText = `
            position: fixed;
            width: ${Math.random() * 100 + 50}px;
            height: ${Math.random() * 100 + 50}px;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation-delay: -${Math.random() * 20}s;
            opacity: ${Math.random() * 0.1 + 0.02};
            z-index: -1;
        `;
        document.body.appendChild(particle);
    }
    
    // Initialize with detailed view
    showView('detailed');
});

// View switching
function showView(viewName) {
    // Hide all views
    document.querySelectorAll('.view-container').forEach(view => {
        view.classList.remove('active');
    });
    
    // Show selected view
    document.getElementById(viewName + 'View').classList.add('active');
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('data-view') === viewName) {
            btn.classList.add('active');
        }
    });
    
    // Animate the switch
    const activeView = document.getElementById(viewName + 'View');
    activeView.style.animation = 'none';
    setTimeout(() => {
        activeView.style.animation = 'fadeIn 0.5s ease';
    }, 10);
}

// Tab button event listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const viewName = this.getAttribute('data-view');
        showView(viewName);
        
        // Add click effect
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = '';
        }, 150);
    });
});

// Show status details in modal
function showStatusDetails() {
    Swal.fire({
        title: `<div style="color: <?= $status_color ?>;"><i class="<?= $status_icon ?> fa-3x mb-3"></i><br>${<?= json_encode($status_label) ?>}</div>`,
        html: `
            <div style="text-align: left; padding: 1rem; background: rgba(26, 26, 46, 0.5); border-radius: 10px; margin: 1rem 0;">
                <p><strong>Status:</strong> <span style="color: <?= $status_color ?>">${<?= json_encode($status_label) ?>}</span></p>
                <p><strong>Description:</strong> ${<?= json_encode($status_hindi) ?>}</p>
                <p><strong>Job Number:</strong> ${<?= json_encode($job_id) ?>}</p>
                <p><strong>Repair Code:</strong> ${<?= json_encode($code) ?>}</p>
            </div>
            <div style="background: linear-gradient(135deg, <?= str_replace('0.2', '0.1', $status_bg) ?>, rgba(26, 26, 46, 0.5)); 
                        padding: 1rem; border-radius: 10px; border-left: 4px solid <?= $status_color ?>;">
                <small class="text-muted">
                    <i class="fa fa-info-circle"></i> Status updated automatically as your job progresses.
                </small>
            </div>
        `,
        icon: 'info',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        showConfirmButton: false,
        showCloseButton: true,
        backdrop: 'rgba(0, 0, 0, 0.8)'
    });
}

// Print job details
function printJobDetails() {
    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Job Details - ${<?= json_encode($job_id) ?>}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 20px; }
                    .section { margin-bottom: 25px; }
                    .section-title { background: #f5f5f5; padding: 10px; font-weight: bold; border-left: 4px solid #667eea; }
                    .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 15px 0; }
                    .info-item { padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
                    .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    .table th { background: #667eea; color: white; padding: 10px; text-align: left; }
                    .table td { padding: 10px; border-bottom: 1px solid #ddd; }
                    .total { font-size: 24px; font-weight: bold; color: #10b981; text-align: center; margin: 30px 0; }
                    .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
                    @media print {
                        .no-print { display: none; }
                        body { margin: 0; padding: 10px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Job Status Report</h1>
                    <p>Job Number: ${<?= json_encode($job_id) ?>} | Repair Code: ${<?= json_encode($code) ?>}</p>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="section">
                    <div class="section-title">Client Information</div>
                    <div class="info-grid">
                        <div class="info-item"><strong>Name:</strong> ${<?= json_encode(ucwords($client)) ?>}</div>
                        <div class="info-item"><strong>Contact:</strong> ${<?= json_encode($contact) ?>}</div>
                        <div class="info-item"><strong>Item:</strong> ${<?= json_encode(ucwords($item)) ?>}</div>
                        <div class="info-item"><strong>Fault:</strong> ${<?= json_encode(ucwords($fault)) ?>}</div>
                    </div>
                </div>
                
                ${<?= json_encode($services) ?> ? `
                <div class="section">
                    <div class="section-title">Services Provided</div>
                    <table class="table">
                        <tr>
                            <th>Service</th>
                            <th>Price</th>
                        </tr>
                        ${<?= json_encode($services) ?>.map(service => `
                            <tr>
                                <td>${service.service_name}</td>
                                <td>₹${parseFloat(service.price).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
                ` : ''}
                
                ${<?= json_encode($products) ?> ? `
                <div class="section">
                    <div class="section-title">Products Used</div>
                    <table class="table">
                        <tr>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                        ${<?= json_encode($products) ?>.map(product => `
                            <tr>
                                <td>${product.product_name}</td>
                                <td>${product.qty}</td>
                                <td>₹${parseFloat(product.price).toFixed(2)}</td>
                                <td>₹${parseFloat(product.total).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
                ` : ''}
                
                <div class="section">
                    <div class="section-title">Payment Summary</div>
                    <div class="total">Total Amount: ₹${<?= json_encode(number_format($amount, 2)) ?>}</div>
                </div>
                
                ${<?= json_encode(!empty($remark)) ?> ? `
                <div class="section">
                    <div class="section-title">Remarks</div>
                    <p>${<?= json_encode(nl2br(htmlspecialchars($remark))) ?>}</p>
                </div>
                ` : ''}
                
                <div class="section">
                    <div class="section-title">Current Status</div>
                    <p><strong>${<?= json_encode($status_label) ?>}</strong> - ${<?= json_encode($status_hindi) ?>}</p>
                </div>
                
                <div class="footer">
                    <p>This is an automatically generated report. For any queries, please contact our support.</p>
                    <p>Report ID: ${<?= json_encode($code) ?>}-${Date.now()}</p>
                </div>
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    };
                <\/script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// Share job status
function shareJobStatus() {
    if(navigator.share) {
        navigator.share({
            title: 'My Job Status - <?= $job_id ?>',
            text: `Check my job status: <?= $job_id ?> - Currently: <?= $status_label ?>\nTotal Amount: ₹<?= number_format($amount, 2) ?>`,
            url: window.location.href
        })
        .then(() => console.log('Successful share'))
        .catch(error => console.log('Error sharing:', error));
    } else {
        // Fallback: Copy to clipboard
        const shareText = `Job Status\n\nJob Number: <?= $job_id ?>\nRepair Code: <?= $code ?>\nStatus: <?= $status_label ?>\nTotal Amount: ₹<?= number_format($amount, 2) ?>\n\nView details: ${window.location.href}`;
        
        navigator.clipboard.writeText(shareText)
            .then(() => {
                Swal.fire({
                    title: 'Copied to Clipboard!',
                    text: 'Job details copied. You can now paste and share.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                Swal.fire({
                    title: 'Share Not Supported',
                    text: 'Please copy the URL manually to share.',
                    icon: 'info'
                });
            });
    }
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+P for print
    if((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        printJobDetails();
    }
    
    // Escape to go back
    if(e.key === 'Escape') {
        window.location.href = './?p=check_status';
    }
});

// Add hover effects to cards
document.querySelectorAll('.info-card, .service-table, .product-table').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// Auto-refresh status every 30 seconds
setInterval(() => {
    // Optional: Add auto-refresh functionality here
    // Could make an AJAX call to check for status updates
}, 30000);
</script>
</body>
</html>