<?php
require_once '../config.php';

if(!isset($_GET['type']) || !isset($_GET['id'])){
    die("Invalid request.");
}

$type = $_GET['type'];
$id = $_GET['id'];
$bill_type = isset($_GET['bill_type']) ? $_GET['bill_type'] : 'gst'; // Default GST

if($type == 'transaction'){
    $qry = $conn->query("SELECT t.*, c.firstname, c.middlename, c.lastname, c.contact, c.address, c.email 
                         FROM transaction_list t 
                         LEFT JOIN client_list c ON t.client_name = c.id 
                         WHERE t.id = '$id'");
}elseif($type == 'direct_sale'){
    $qry = $conn->query("SELECT ds.*, c.firstname, c.middlename, c.lastname, c.contact, c.address, c.email 
                         FROM direct_sales ds 
                         LEFT JOIN client_list c ON ds.client_id = c.id 
                         WHERE ds.id = '$id'");
}

if($qry->num_rows == 0) die("Record not found.");
$res = $qry->fetch_assoc();

$client_name = trim($res['firstname'].' '.($res['middlename']?:'').' '.$res['lastname']);
$client_name = $client_name ?: 'Walk-in Customer';
$job_code = $type == 'transaction' ? $res['job_id'] : $res['sale_code'];
$date = date("d-m-Y", strtotime($res['date_created']));
$amount = $res['total_amount'] ?? $res['amount'];

// Shop Details
$shop_name = "V-Technologies";
$shop_address = "F4, Hotel Plaza (Now Madhushala), Beside Jayanti Complex, Marhatal, Jabalpur";
$shop_mobile = "9179105875";
$shop_gst = "22AAAAA0000A1Z5";
$shop_logo = "../uploads/logo.png"; // अपना logo path डालें

// GST Calculation (only if bill_type is 'gst')
$cgst_rate = 9;
$sgst_rate = 9;

if($bill_type == 'gst'){
    // GST Bill Calculation
    $taxable_amount = $amount;
    $cgst_amount = $taxable_amount * ($cgst_rate / 100);
    $sgst_amount = $taxable_amount * ($sgst_rate / 100);
    $grand_total = $taxable_amount + $cgst_amount + $sgst_amount;
    $gst_total = $cgst_amount + $sgst_amount;
    $invoice_title = "TAX INVOICE";
    $bill_type_text = "GST Invoice";
} else {
    // Non-GST Bill Calculation
    $taxable_amount = $amount;
    $cgst_amount = 0;
    $sgst_amount = 0;
    $grand_total = $taxable_amount;
    $gst_total = 0;
    $invoice_title = "ESTIMATE";
    $bill_type_text = "Estimate";
}
?>
<!DOCTYPE html>
<html>
<head>
    <title><?= $bill_type_text ?> - <?= $job_code ?></title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Reset and base styles */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body { 
            font-family: 'Arial', sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5; 
            font-size: 14px;
            line-height: 1.5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .container { 
            width: 210mm; /* A4 width */
            min-height: 297mm; /* A4 height */
            margin: 0 auto 20px auto; 
            background: white; 
            padding: 20px;
            position: relative;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        
        /* Header Styles */
        .header-top { 
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            border-bottom: 2px solid #28a745;
            padding-bottom: 15px;
            page-break-inside: avoid;
        }
        
        .logo-container {
            flex: 1;
            min-width: 150px;
        }
        
        .shop-logo {
            max-height: 70px;
            max-width: 180px;
            object-fit: contain;
        }
        
        .shop-info {
            flex: 2;
            text-align: center;
            padding: 0 15px;
        }
        
        .bill-type-container {
            flex: 1;
            text-align: right;
            min-width: 150px;
        }
        
        .shop-name { 
            font-size: 24px; 
            font-weight: bold; 
            color: #28a745; 
            margin: 0 0 5px 0;
            text-transform: uppercase;
        }
        
        .shop-tagline {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
            font-style: italic;
        }
        
        .shop-details { 
            font-size: 12px; 
            color: #555; 
            line-height: 1.4;
        }
        
        .invoice-title { 
            font-size: 22px; 
            font-weight: bold; 
            color: #dc3545; 
            margin: 15px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .bill-type-badge {
            display: inline-block;
            padding: 8px 20px;
            background: <?= $bill_type == 'gst' ? '#dc3545' : '#17a2b8' ?>;
            color: white;
            font-weight: bold;
            font-size: 14px;
            border-radius: 4px;
            text-transform: uppercase;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        /* Invoice Info */
        .invoice-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            border: 1px solid #dee2e6;
            page-break-inside: avoid;
        }
        
        .info-left, .info-right {
            flex: 1;
        }
        
        .info-group { 
            margin-bottom: 8px;
            display: flex;
        }
        
        .info-label { 
            font-weight: bold; 
            color: #495057; 
            min-width: 120px;
            font-size: 13px;
        }
        
        .info-value { 
            color: #212529;
            font-size: 13px;
        }
        
        /* Client Info */
        .client-info { 
            margin: 20px 0; 
            padding: 15px; 
            background: #f8f9fa; 
            border: 1px solid #dee2e6; 
            border-radius: 5px;
            page-break-inside: avoid;
        }
        
        .client-title {
            font-size: 16px;
            font-weight: bold;
            color: #495057;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #007bff;
        }
        
        .client-details { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 10px;
        }
        
        /* Items Table */
        .items-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
            border: 1px solid #dee2e6;
            font-size: 13px;
            page-break-inside: avoid;
        }
        
        .items-table th { 
            background: #007bff; 
            color: white; 
            padding: 10px 8px; 
            text-align: left; 
            border: 1px solid #0056b3;
            font-weight: 600;
            font-size: 13px;
        }
        
        .items-table td { 
            padding: 8px 8px; 
            border: 1px solid #dee2e6; 
            vertical-align: top;
            font-size: 13px;
        }
        
        .items-table tr:nth-child(even) { 
            background: #f8f9fa; 
        }
        
        .text-right { 
            text-align: right; 
        }
        
        .text-center { 
            text-align: center; 
        }
        
        /* Amount Section */
        .amount-section { 
            margin-top: 20px; 
            width: 100%; 
            border-collapse: collapse;
            font-size: 13px;
            page-break-inside: avoid;
        }
        
        .amount-section td { 
            padding: 10px 15px; 
            border: 1px solid #dee2e6;
        }
        
        .amount-label { 
            text-align: right; 
            font-weight: 600; 
            background: #f8f9fa;
            width: 70%;
        }
        
        .amount-value { 
            text-align: right; 
            font-weight: 600; 
            width: 30%;
        }
        
        .gst-row { 
            background: #e7f1ff; 
        }
        
        .total-row { 
            background: #ffc107; 
            font-size: 14px; 
            font-weight: bold;
        }
        
        /* Footer */
        .footer { 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px dashed #ccc; 
            text-align: center;
            page-break-inside: avoid;
        }
        
        .thank-you { 
            font-size: 16px; 
            font-weight: bold; 
            color: #28a745; 
            margin-bottom: 10px;
        }
        
        .signature { 
            margin-top: 50px; 
            text-align: right; 
            padding-right: 50px;
        }
        
        /* Terms & Conditions */
        .terms-box {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            font-size: 12px;
            page-break-inside: avoid;
        }
        
        /* Print Optimizations */
        @media print {
            @page {
                margin: 0;
                size: A4 portrait;
            }
            
            body { 
                margin: 0;
                padding: 0;
                background: white; 
                font-size: 12px;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                min-height: auto;
                display: block;
            }
            
            .container { 
                width: 100%;
                min-height: auto;
                margin: 0;
                padding: 15mm;
                box-shadow: none; 
                border: none;
                page-break-after: avoid;
                page-break-inside: avoid;
            }
            
            .no-print { 
                display: none !important; 
            }
            
            .page-break { 
                page-break-before: always; 
            }
            
            .shop-logo { 
                max-height: 60px; 
            }
            
            .shop-name { 
                font-size: 20px; 
            }
            
            .invoice-title { 
                font-size: 18px; 
            }
            
            .items-table { 
                font-size: 11px; 
            }
            
            /* Force single page */
            .container, .header-top, .invoice-info, .client-info, .items-table, .amount-section, .terms-box, .footer {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            
            /* Prevent orphans and widows */
            p, h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
                page-break-inside: avoid;
            }
            
            table {
                page-break-inside: avoid;
            }
        }
        
        /* Button Container - Always visible and properly positioned */
        .button-container { 
            text-align: center; 
            margin: 30px auto;
            padding: 20px; 
            background: #f8f9fa; 
            border-radius: 8px;
            border: 2px solid #dee2e6;
            width: 210mm;
            max-width: 100%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            position: relative;
            z-index: 100;
        }
        
        .btn { 
            padding: 12px 24px; 
            margin: 8px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 14px; 
            font-weight: bold;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s;
            min-width: 200px;
        }
        
        .btn:hover { 
            transform: translateY(-3px); 
            box-shadow: 0 6px 12px rgba(0,0,0,0.15); 
        }
        
        .btn-print { 
            background: #28a745; 
            color: white; 
        }
        
        .btn-print:hover {
            background: #218838;
        }
        
        .btn-download { 
            background: #007bff; 
            color: white; 
        }
        
        .btn-download:hover {
            background: #0056b3;
        }
        
        .btn-close { 
            background: #6c757d; 
            color: white; 
        }
        
        .btn-close:hover {
            background: #545b62;
        }
        
        .btn-gst { 
            background: #dc3545; 
            color: white; 
        }
        
        .btn-gst:hover {
            background: #c82333;
        }
        
        .btn-non-gst { 
            background: #17a2b8; 
            color: white; 
        }
        
        .btn-non-gst:hover {
            background: #138496;
        }
        
        .btn-group {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .btn-group-title {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 20px;
            width: 100%;
            text-align: center;
        }
        
        /* Responsive for screen */
        @media screen and (max-width: 1200px) {
            .container { 
                width: 100%;
                max-width: 100%;
                padding: 15px;
                margin: 10px auto;
            }
            
            .button-container {
                width: 100%;
                max-width: 100%;
                margin: 20px auto;
            }
        }
        
        @media screen and (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .header-top { 
                flex-direction: column; 
                text-align: center; 
            }
            
            .logo-container, .bill-type-container {
                text-align: center;
                margin-bottom: 15px;
            }
            
            .shop-info { 
                padding: 0;
                order: 1;
            }
            
            .client-details { 
                grid-template-columns: 1fr; 
            }
            
            .invoice-info { 
                flex-direction: column; 
            }
            
            .btn-group {
                flex-direction: column;
                align-items: center;
            }
            
            .btn {
                width: 100%;
                max-width: 300px;
                margin: 5px 0;
            }
            
            .button-container {
                padding: 15px;
            }
        }
        
        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 10px;
        }
        
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 5px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 5px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
    </style>
</head>
<body>
<div class="container">
    <!-- Header with Logo -->
    <div class="header-top">
        <div class="logo-container">
            <?php if(file_exists($shop_logo)): ?>
                <img src="<?= $shop_logo ?>" class="shop-logo" alt="<?= $shop_name ?>" onerror="this.style.display='none'">
            <?php else: ?>
                <div style="font-size: 20px; font-weight: bold; color: #28a745;"><?= $shop_name ?></div>
            <?php endif; ?>
        </div>
        
        <div class="shop-info">
            <div class="shop-name"><?= $shop_name ?></div>
            <div class="shop-tagline">Power Supply Solutions</div>
            <div class="shop-details">
                <?= $shop_address ?><br>
                📞 <?= $shop_mobile ?><br>
                <?php if($bill_type == 'gst'): ?>
                🏢 GSTIN: <?= $shop_gst ?>
                <?php endif; ?>
            </div>
        </div>
        
        <div class="bill-type-container">
            <div class="bill-type-badge">
                <?= $bill_type_text ?>
            </div>
        </div>
    </div>

    <!-- Invoice Title -->
    <div class="invoice-title text-center">
        <?= $invoice_title ?>
    </div>

    <!-- Invoice Information -->
    <div class="invoice-info">
        <div class="info-left">
            <div class="info-group">
                <span class="info-label">Invoice No:</span>
                <span class="info-value"><?= $job_code ?></span>
            </div>
            <div class="info-group">
                <span class="info-label">Invoice Date:</span>
                <span class="info-value"><?= $date ?></span>
            </div>
        </div>
        <div class="info-right">
            <div class="info-group">
                <span class="info-label">Invoice Time:</span>
                <span class="info-value"><?= date("h:i A", strtotime($res['date_created'])) ?></span>
            </div>
            <?php if(isset($res['payment_mode'])): ?>
            <div class="info-group">
                <span class="info-label">Payment Mode:</span>
                <span class="info-value" style="color: #28a745; font-weight: bold;">
                    <?= strtoupper($res['payment_mode']) ?>
                </span>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <!-- Client Information -->
    <div class="client-info">
        <div class="client-title">
            <i class="fas fa-user"></i> Customer Details
        </div>
        <div class="client-details">
            <div class="info-group">
                <span class="info-label">Customer Name:</span>
                <span class="info-value"><strong><?= $client_name ?></strong></span>
            </div>
            <div class="info-group">
                <span class="info-label">Mobile No:</span>
                <span class="info-value"><?= $res['contact'] ?: '—' ?></span>
            </div>
            <div class="info-group">
                <span class="info-label">Email ID:</span>
                <span class="info-value"><?= $res['email'] ?: '—' ?></span>
            </div>
            <div class="info-group" style="grid-column: span 2;">
                <span class="info-label">Address:</span>
                <span class="info-value"><?= $res['address'] ?: '—' ?></span>
            </div>
        </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
        <thead>
            <tr>
                <th width="5%" class="text-center">#</th>
                <th>Description</th>
                <th width="10%" class="text-center">Qty</th>
                <th width="15%" class="text-right">Rate (₹)</th>
                <th width="15%" class="text-right">Amount (₹)</th>
            </tr>
        </thead>
        <tbody>
            <?php 
            $i = 1;
            $subtotal = 0;
            
            if($type == 'transaction'){
                // Products
                $p_qry = $conn->query("SELECT tp.qty, tp.price, p.name FROM transaction_products tp JOIN product_list p ON tp.product_id = p.id WHERE tp.transaction_id = '$id'");
                while($row = $p_qry->fetch_assoc()){
                    $item_total = $row['qty'] * $row['price'];
                    $subtotal += $item_total;
                    echo "<tr>
                        <td class='text-center'>{$i}</td>
                        <td>{$row['name']} (Part)</td>
                        <td class='text-center'>{$row['qty']}</td>
                        <td class='text-right'>".number_format($row['price'], 2)."</td>
                        <td class='text-right'>".number_format($item_total, 2)."</td>
                    </tr>";
                    $i++;
                }
                
                // Services
                $s_qry = $conn->query("SELECT ts.price, s.* FROM transaction_services ts JOIN service_list s ON ts.service_id = s.id WHERE ts.transaction_id = '$id'");
                while($row = $s_qry->fetch_assoc()){
                    $service_qty = 1;
                    $service_name = $row['service'] ?? $row['name'] ?? $row['title'] ?? $row['description'] ?? 'Repair Service';
                    $service_total = $service_qty * $row['price'];
                    $subtotal += $service_total;
                    echo "<tr>
                        <td class='text-center'>{$i}</td>
                        <td>{$service_name} (Service)</td>
                        <td class='text-center'>{$service_qty}</td>
                        <td class='text-right'>".number_format($row['price'], 2)."</td>
                        <td class='text-right'>".number_format($service_total, 2)."</td>
                    </tr>";
                    $i++;
                }
                
            } elseif($type == 'direct_sale'){
                $items_qry = $conn->query("SELECT dsi.qty, dsi.price, p.name FROM direct_sale_items dsi JOIN product_list p ON dsi.product_id = p.id WHERE dsi.sale_id = '$id'");
                while($row = $items_qry->fetch_assoc()){
                    $item_total = $row['qty'] * $row['price'];
                    $subtotal += $item_total;
                    echo "<tr>
                        <td class='text-center'>{$i}</td>
                        <td>{$row['name']}</td>
                        <td class='text-center'>{$row['qty']}</td>
                        <td class='text-right'>".number_format($row['price'], 2)."</td>
                        <td class='text-right'>".number_format($item_total, 2)."</td>
                    </tr>";
                    $i++;
                }
            }
            
            // If no items found
            if($i == 1){
                echo "<tr><td colspan='5' class='text-center'>No items found</td></tr>";
            }
            ?>
        </tbody>
    </table>

    <!-- Amount Calculation -->
    <table class="amount-section">
        <tr>
            <td class="amount-label">Subtotal:</td>
            <td class="amount-value">₹<?= number_format($subtotal, 2) ?></td>
        </tr>
        
        <?php if($bill_type == 'gst'): ?>
        <tr class="gst-row">
            <td class="amount-label">CGST @ <?= $cgst_rate ?>%:</td>
            <td class="amount-value">₹<?= number_format($cgst_amount, 2) ?></td>
        </tr>
        <tr class="gst-row">
            <td class="amount-label">SGST @ <?= $sgst_rate ?>%:</td>
            <td class="amount-value">₹<?= number_format($sgst_amount, 2) ?></td>
        </tr>
        <tr class="gst-row">
            <td class="amount-label">Total GST:</td>
            <td class="amount-value">₹<?= number_format($gst_total, 2) ?></td>
        </tr>
        <?php endif; ?>
        
        <tr class="total-row">
            <td class="amount-label">Grand Total:</td>
            <td class="amount-value">₹<?= number_format($grand_total, 2) ?></td>
        </tr>
        
        <!-- Amount in Words -->
        <tr>
            <td colspan="2" style="padding: 12px; border: 1px solid #dee2e6; background: #f8f9fa; font-size: 13px;">
                <strong>Amount in Words:</strong> 
                <span id="amountInWords"></span>
            </td>
        </tr>
    </table>

    <!-- Terms and Conditions -->
    <div class="terms-box">
        <strong><i class="fas fa-info-circle"></i> Terms & Conditions:</strong>
        <ol style="margin: 8px 0 0 0; padding-left: 20px;">
            <li>Goods once sold will not be taken back or exchanged.</li>
            <li>All disputes are subject to Jabalpur Jurisdiction only.</li>
            <li>Warranty as per manufacturer's terms and conditions.</li>
            <li>Please check all items at the time of delivery.</li>
            <li>Keep this invoice for warranty claim.</li>
            <li>E. & O.E.</li>
        </ol>
    </div>

    <!-- Footer -->
    <div class="footer">
        <div class="thank-you">
            <i class="fas fa-heart" style="color: #dc3545;"></i> Thank You for Your Business!
        </div>
        <div style="color: #666; margin: 15px 0; font-size: 13px;">
            For any queries, please contact: <?= $shop_mobile ?> | Email: vtech.jbp@gmail.com
        </div>
        
        <div class="signature">
            <div style="border-top: 1px solid #333; width: 250px; display: inline-block; padding-top: 10px; font-size: 13px;">
                For <?= $shop_name ?><br>
                <strong>Authorized Signature</strong>
            </div>
        </div>
    </div>
</div>

<!-- Action Buttons - Separate from invoice container -->
<div class="button-container no-print">
    <div class="btn-group-title">
        Select Bill Type
    </div>
    <div class="btn-group">
        <a href="?type=<?= $type ?>&id=<?= $id ?>&bill_type=gst" class="btn btn-gst">
            <i class="fas fa-file-invoice-dollar"></i> Generate GST Invoice
        </a>
        <a href="?type=<?= $type ?>&id=<?= $id ?>&bill_type=non_gst" class="btn btn-non-gst">
            <i class="fas fa-store"></i> Generate Retail Invoice
        </a>
    </div>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 2px dashed #ccc;">
        <div class="btn-group">
            <button onclick="window.print()" class="btn btn-print">
                <i class="fas fa-print"></i> Print Invoice
            </button>
            <button onclick="downloadPDF()" class="btn btn-download">
                <i class="fas fa-download"></i> Save as PDF
            </button>
            <button onclick="window.close()" class="btn btn-close">
                <i class="fas fa-times"></i> Close Window
            </button>
        </div>
    </div>
</div>

<script>
// Function to convert number to words (Improved Version)
function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero Rupees Only';
    
    let words = '';
    
    // Crores
    if (Math.floor(num / 10000000) > 0) {
        words += numberToWordsHelper(Math.floor(num / 10000000)) + ' Crore ';
        num %= 10000000;
    }
    
    // Lakhs
    if (Math.floor(num / 100000) > 0) {
        words += numberToWordsHelper(Math.floor(num / 100000)) + ' Lakh ';
        num %= 100000;
    }
    
    // Thousands
    if (Math.floor(num / 1000) > 0) {
        words += numberToWordsHelper(Math.floor(num / 1000)) + ' Thousand ';
        num %= 1000;
    }
    
    // Hundreds
    if (Math.floor(num / 100) > 0) {
        words += numberToWordsHelper(Math.floor(num / 100)) + ' Hundred ';
        num %= 100;
    }
    
    // Below Hundred
    if (num > 0) {
        if (words !== '') words += 'and ';
        
        if (num < 20) {
            words += ones[num];
        } else {
            words += tens[Math.floor(num / 10)];
            if (num % 10 > 0) {
                words += ' ' + ones[num % 10];
            }
        }
    }
    
    return words.trim() + ' Rupees Only';
    
    // Helper function for conversion without suffix
    function numberToWordsHelper(num) {
        let word = '';
        
        if (Math.floor(num / 100) > 0) {
            word += ones[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }
        
        if (num > 0) {
            if (num < 20) {
                word += ones[num];
            } else {
                word += tens[Math.floor(num / 10)];
                if (num % 10 > 0) {
                    word += ' ' + ones[num % 10];
                }
            }
        }
        
        return word.trim();
    }
}

// Set amount in words
window.onload = function() {
    const grandTotal = <?= $grand_total ?>;
    const amountInWords = numberToWords(Math.floor(grandTotal));
    document.getElementById('amountInWords').textContent = amountInWords;
    
    // Auto-scroll to show buttons
    setTimeout(function() {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }, 500);
    
    <?php if(isset($_GET['auto_print']) && $_GET['auto_print'] == '1'): ?>
    setTimeout(function() {
        window.print();
    }, 1000);
    <?php endif; ?>
};

// Function to download as PDF
function downloadPDF() {
    // First print the document
    window.print();
    
    // Show a message
    setTimeout(function() {
        alert("For best PDF quality:\n1. Select 'Save as PDF' in print dialog\n2. Set Paper Size: A4\n3. Set Margins: 'Default' or 'Minimum'\n4. Check 'Background graphics' option");
    }, 100);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+P for print
    if(e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        window.print();
    }
    // Ctrl+S for save/PDF
    if(e.ctrlKey && e.key === 's') {
        e.preventDefault();
        downloadPDF();
    }
    // Escape to close
    if(e.key === 'Escape') {
        window.close();
    }
});

// Show print message
window.addEventListener('beforeprint', function() {
    console.log('Printing invoice...');
});

// Auto-close after print (optional)
window.addEventListener('afterprint', function() {
    // Uncomment the line below if you want to auto-close after printing
    // setTimeout(function() { window.close(); }, 1000);
});

// Ensure buttons are always visible
window.addEventListener('scroll', function() {
    const buttonContainer = document.querySelector('.button-container');
    const containerBottom = document.querySelector('.container').getBoundingClientRect().bottom;
    const viewportHeight = window.innerHeight;
    
    // If invoice container is too tall, make sure buttons are visible
    if (containerBottom > viewportHeight - 100) {
        buttonContainer.style.position = 'relative';
        buttonContainer.style.bottom = 'auto';
    }
});
</script>

<!-- Font Awesome for Icons -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

</body>
</html>