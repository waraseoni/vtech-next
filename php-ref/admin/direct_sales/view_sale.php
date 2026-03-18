<?php
// Helper function for amount in words - TOP PAR DEFINE KARENGE
if(!function_exists('convertNumberToWords')) {
    function convertNumberToWords($amount) {
        $amount = number_format($amount, 2, '.', '');
        list($rupees, $paise) = explode('.', $amount);
        
        $words = 'Rupees ' . numberToWords($rupees);
        if ($paise > 0) {
            $words .= ' and ' . numberToWords($paise) . ' Paise';
        }
        $words .= ' Only';
        
        return $words;
    }
    
    function numberToWords($num) {
        $ones = array(
            0 => "", 1 => "One", 2 => "Two", 3 => "Three", 4 => "Four",
            5 => "Five", 6 => "Six", 7 => "Seven", 8 => "Eight", 9 => "Nine",
            10 => "Ten", 11 => "Eleven", 12 => "Twelve", 13 => "Thirteen",
            14 => "Fourteen", 15 => "Fifteen", 16 => "Sixteen", 17 => "Seventeen",
            18 => "Eighteen", 19 => "Nineteen"
        );
        
        $tens = array(
            2 => "Twenty", 3 => "Thirty", 4 => "Forty", 5 => "Fifty",
            6 => "Sixty", 7 => "Seventy", 8 => "Eighty", 9 => "Ninety"
        );
        
        if ($num == 0) {
            return "Zero";
        }
        
        if ($num < 20) {
            return $ones[$num];
        }
        
        if ($num < 100) {
            return $tens[floor($num / 10)] . (($num % 10 != 0) ? " " . $ones[$num % 10] : "");
        }
        
        if ($num < 1000) {
            return $ones[floor($num / 100)] . " Hundred" . (($num % 100 != 0) ? " " . numberToWords($num % 100) : "");
        }
        
        if ($num < 100000) {
            return numberToWords(floor($num / 1000)) . " Thousand" . (($num % 1000 != 0) ? " " . numberToWords($num % 1000) : "");
        }
        
        if ($num < 10000000) {
            return numberToWords(floor($num / 100000)) . " Lakh" . (($num % 100000 != 0) ? " " . numberToWords($num % 100000) : "");
        }
        
        return number_format($num);
    }
}

// Ab database query aur baaki code
if(isset($_GET['id'])){
    // SQL injection protection ke liye prepared statement use karenge
    // Current save_direct_sale() function ke according fields check karenge
    $stmt = $conn->prepare("SELECT ds.*, 
                         CONCAT(COALESCE(c.firstname,''), ' ', COALESCE(c.middlename,''), ' ', COALESCE(c.lastname,'')) as client_name,
                         CONCAT(COALESCE(m.firstname,''), ' ', COALESCE(m.lastname,'')) as mechanic_name,
                         c.contact as client_phone,
                         c.address as client_address
                         FROM direct_sales ds 
                         LEFT JOIN client_list c ON ds.client_id = c.id 
                         LEFT JOIN mechanic_list m ON ds.mechanic_id = m.id 
                         WHERE ds.id = ?");
    
    if($stmt){
        $stmt->bind_param("i", $_GET['id']);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if($result->num_rows > 0){
            $sale_data = $result->fetch_assoc();
            foreach($sale_data as $k => $v){
                $$k = $v;
            }
            
            // Last editor ka name nikalna - save_direct_sale() ke according
            $last_editor_name = '';
            $last_editor_type = '';
            $last_edited_date_display = '';
            
            // Pehle check karenge ki last_edited_by field exist karti hai ya nahi
            if(isset($last_edited_by) && !empty($last_edited_by)) {
                // Agar last_edited_by 0 hai ya empty hai, to iska matlab admin ne edit kiya hai
                if($last_edited_by == 0 || empty($last_edited_by)) {
                    $last_editor_name = 'Admin';
                    $last_editor_type = 'Admin';
                } else {
                    // Mechanic ne edit kiya hai
                    $mech_stmt = $conn->prepare("SELECT CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE id = ?");
                    if($mech_stmt) {
                        $mech_stmt->bind_param("i", $last_edited_by);
                        $mech_stmt->execute();
                        $mech_result = $mech_stmt->get_result();
                        if($mech_result->num_rows > 0) {
                            $mech_data = $mech_result->fetch_assoc();
                            $last_editor_name = $mech_data['name'];
                            $last_editor_type = 'Staff';
                        }
                        $mech_stmt->close();
                    }
                }
            }
            
            // Last edited date
            if(isset($last_edited_date) && !empty($last_edited_date)) {
                $last_edited_date_display = date("d-m-Y h:i A", strtotime($last_edited_date));
            }
            
            // Last edited info string prepare karenge
            $last_edited_info = '';
            if(!empty($last_editor_name)) {
                $last_edited_info = "Last edited by: " . $last_editor_name . " (" . $last_editor_type . ")";
                if(!empty($last_edited_date_display)) {
                    $last_edited_info .= " on " . $last_edited_date_display;
                }
            }
            
            // GST ko optional rakhenge - database mein gst_amount field check karenge
            $show_gst = false;
            $gst_amount = 0;
            
            // Check if GST amount exists in database and is greater than 0
            if(isset($sale_data['gst_amount']) && floatval($sale_data['gst_amount']) > 0){
                $gst_amount = floatval($sale_data['gst_amount']);
                $show_gst = true;
            }
            
            // Calculate subtotal from items
            $subtotal = isset($total_amount) ? $total_amount : 0;
            $grand_total = $subtotal;
            
        } else {
            echo "<script>alert('Sale record not found!'); location.href='./?page=direct_sales';</script>";
            exit;
        }
        $stmt->close();
    } else {
        echo "<script>alert('Database error!'); location.href='./?page=direct_sales';</script>";
        exit;
    }
} else {
    header("Location: ./?page=direct_sales");
    exit;
}
?>
<div class="content py-4">
    <div class="card card-outline card-primary rounded-3 shadow-lg border-0">
        <div class="card-header bg-gradient-primary text-white py-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap">
                <div class="mb-2 mb-md-0">
                    <h4 class="card-title mb-0">
                        <i class="fas fa-receipt me-2"></i>Sale Invoice: <?= htmlspecialchars($sale_code ?? 'N/A') ?>
                    </h4>
                    <small class="opacity-75">Invoice Date: <?= date("F d, Y", strtotime($date_created ?? date('Y-m-d'))) ?></small>
                    
                    <?php if(!empty($last_edited_info)): ?>
                    <div class="mt-1">
                        <small class="opacity-75">
                            <i class="fas fa-user-edit me-1"></i> <?= htmlspecialchars($last_edited_info) ?>
                        </small>
                    </div>
                    <?php endif; ?>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                <!--    <a href="../pdf/gst_bill.php?type=direct_sale&id=<?= $id ?>" target="_blank" class="btn btn-success btn-sm mb-2 mb-md-0">
                        <i class="fas fa-file-invoice me-1"></i> GST Bill
                    </a> -->
                    <!-- EDIT BUTTON ADDED HERE -->
                    <a href="./?page=direct_sales/manage_sale&id=<?= $id ?>" class="btn btn-warning btn-sm mb-2 mb-md-0 d-print-none">
                        <i class="fas fa-edit me-1"></i> Edit
                    </a>
               <!--        <button class="btn btn-info btn-sm mb-2 mb-md-0" onclick="window.print()">
                        <i class="fas fa-print me-1"></i> Print
                    </button>-->
                    <a href="./?page=direct_sales" class="btn btn-outline-light btn-sm mb-2 mb-md-0">
                        <i class="fas fa-arrow-left me-1"></i> Back
                    </a>
                </div>
            </div>
        </div>
        
        <div class="card-body p-4">
            <!-- Status Badge -->
            <div class="mb-4">
                <span class="badge bg-success fs-6 py-2 px-3">
                    <i class="fas fa-check-circle me-1"></i> Pay mode <?= isset($payment_mode) ? strtoupper($payment_mode) : 'N/A' ?>
                </span>
                
                <?php if(!empty($last_editor_name)): ?>
                <span class="badge bg-info fs-6 py-2 px-3 ms-2">
                    <i class="fas fa-user-edit me-1"></i> Last Edited: <?= htmlspecialchars($last_editor_name) ?>
                </span>
                <?php endif; ?>
            </div>
            
            <div class="container-fluid" id="print_out">
                <!-- Company Header with Logo - UPDATED WITH LOGO LIKE CLIENT_LEDGER_PRINT -->
                <div class="text-center mb-5 position-relative">
                    <div class="d-flex justify-content-center align-items-center mb-3 flex-column flex-md-row">
                        <!-- Logo added here like client_ledger_print.php -->
                        <img src="../uploads/logo.png" alt="Company Logo" class="company-logo me-0 me-md-3 mb-3 mb-md-0" onerror="this.src='../dist/img/AdminLTELogo.png';">
                        <div>
                            <h2 class="fw-bold mb-1 text-primary"><?= htmlspecialchars($_settings->info('name') ?? 'V-Technologies') ?></h2>
                            <p class="mb-0 text-muted"><?= htmlspecialchars($_settings->info('address') ?? 'F4, Hotel Plaza, Marhatal, Jabalpur') ?></p>
                            <p class="mb-0 text-muted"><i class="fas fa-phone me-1"></i> <?= htmlspecialchars($_settings->info('contact') ?? '9179105875') ?></p>
                        </div>
                    </div>
                    <div class="border-bottom border-3 border-primary w-75 mx-auto"></div>
                    <div class="position-absolute top-0 end-0 d-print-none">
                        <span class="badge bg-info">CUSTOMER COPY</span>
                    </div>
                </div>
                
                <!-- Invoice Details -->
                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card border h-100">
                            <div class="card-header bg-light py-2">
                                <h6 class="mb-0"><i class="fas fa-user me-2"></i>Client Details</h6>
                            </div>
                            <div class="card-body py-3">
                                <p class="mb-2"><strong>Name:</strong> 
                                    <?= !empty($client_name) && trim($client_name) != '' ? htmlspecialchars($client_name) : '<span class="text-muted">Walk-in Customer</span>' ?>
                                </p>
                                <?php if(!empty($client_phone)): ?>
                                <p class="mb-2"><strong>Phone:</strong> <?= htmlspecialchars($client_phone) ?></p>
                                <?php endif; ?>
                                <?php if(!empty($client_address)): ?>
                                <p class="mb-0"><strong>Address:</strong> <?= htmlspecialchars($client_address) ?></p>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="card border h-100">
                            <div class="card-header bg-light py-2">
                                <h6 class="mb-0"><i class="fas fa-info-circle me-2"></i>Invoice Info</h6>
                            </div>
                            <div class="card-body py-3">
                                <div class="row">
                                    <div class="col-6">
                                        <p class="mb-2"><strong>Invoice #:</strong></p>
                                        <p class="mb-2"><strong>Date:</strong></p>
                                        <p class="mb-0"><strong>Billed By:</strong></p>
                                        <?php if(!empty($last_editor_name)): ?>
                                        <p class="mb-0 mt-2"><strong>Last Edited:</strong></p>
                                        <?php endif; ?>
                                    </div>
                                    <div class="col-6 text-end">
                                        <p class="mb-2"><?= htmlspecialchars($sale_code ?? 'N/A') ?></p>
                                        <p class="mb-2"><?= date("d-m-Y h:i A", strtotime($date_created ?? date('Y-m-d H:i:s'))) ?></p>
                                        <p class="mb-0"><?= !empty($mechanic_name) && trim($mechanic_name) != '' ? htmlspecialchars($mechanic_name) : 'Admin' ?></p>
                                        <?php if(!empty($last_editor_name)): ?>
                                        <p class="mb-0 mt-2">
                                            <?= htmlspecialchars($last_editor_name) ?>
                                            <?php if(!empty($last_edited_date_display)): ?>
                                            <br><small class="text-muted"><?= $last_edited_date_display ?></small>
                                            <?php endif; ?>
                                        </p>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Products Table -->
                <?php
                // Calculate subtotal from items
                $stmt2 = $conn->prepare("SELECT dsi.*, p.name, p.id FROM direct_sale_items dsi 
                                       INNER JOIN product_list p ON dsi.product_id = p.id 
                                       WHERE sale_id = ?");
                $item_subtotal = 0;
                if($stmt2){
                    $stmt2->bind_param("i", $id);
                    $stmt2->execute();
                    $items = $stmt2->get_result();
                }
                ?>
                <div class="table-responsive mb-4">
                    <table class="table table-hover table-bordered align-middle">
                        <thead class="table-dark">
                            <tr>
                                <th width="5%" class="text-center">#</th>
                                <th width="50%">Product Description</th>
                                <th width="10%" class="text-center">Qty</th>
                                <th width="15%" class="text-end">Unit Price (₹)</th>
                                <th width="20%" class="text-end">Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            if(isset($items) && $items->num_rows > 0){
                                $counter = 1;
                                while($row = $items->fetch_assoc()):
                                    $item_total = $row['qty'] * $row['price'];
                                    $item_subtotal += $item_total;
                            ?>
                            <tr>
                                <td class="text-center"><?= $counter++ ?></td>
                                <td>
                                    <div class="fw-semibold"><?= htmlspecialchars($row['name']) ?></div>
                                    <?php if(!empty($row['product_code'])): ?>
                                    <small class="text-muted">Code: <?= htmlspecialchars($row['product_code']) ?></small>
                                    <?php endif; ?>
                                </td>
                                <td class="text-center">
                                    <span class="badge bg-primary rounded-pill px-3 py-1"><?= $row['qty'] ?></span>
                                </td>
                                <td class="text-end">₹<?= number_format($row['price'], 2) ?></td>
                                <td class="text-end fw-semibold">₹<?= number_format($item_total, 2) ?></td>
                            </tr>
                            <?php 
                                endwhile;
                            } else { ?>
                                <tr>
                                    <td colspan="5" class="text-center text-muted">No items found</td>
                                </tr>
                            <?php } 
                            if(isset($stmt2)) $stmt2->close();
                            ?>
                        </tbody>
                    </table>
                </div>
                
                <!-- Summary Section -->
                <?php
                // Use calculated subtotal if available, otherwise use database total
                $subtotal = ($item_subtotal > 0) ? $item_subtotal : (isset($total_amount) ? $total_amount : 0);
                $grand_total = $subtotal + $gst_amount;
                ?>
                <div class="row justify-content-end">
                    <div class="col-md-6 col-lg-5">
                        <div class="card border-0 bg-light">
                            <div class="card-body p-4">
                                <h6 class="mb-3 border-bottom pb-2">Invoice Summary</h6>
                                <div class="row mb-2">
                                    <div class="col-6">Subtotal:</div>
                                    <div class="col-6 text-end">₹<?= number_format($subtotal, 2) ?></div>
                                </div>
                                
                                <!-- GST Section - Only show if GST is applicable -->
                                <?php if($show_gst && $gst_amount > 0): ?>
                                <div class="row mb-2">
                                    <div class="col-6">GST:</div>
                                    <div class="col-6 text-end">₹<?= number_format($gst_amount, 2) ?></div>
                                </div>
                                <?php endif; ?>
                                
                                <?php if(isset($discount) && $discount > 0): ?>
                                <div class="row mb-2">
                                    <div class="col-6">Discount:</div>
                                    <div class="col-6 text-end">-₹<?= number_format($discount, 2) ?></div>
                                </div>
                                <?php endif; ?>
                                
                                <div class="row mt-3 pt-3 border-top border-2 border-dark">
                                    <div class="col-6 fw-bold fs-5">Total Amount:</div>
                                    <div class="col-6 text-end fw-bold fs-5">₹<?= number_format($grand_total, 2) ?></div>
                                </div>
                                
                                <!-- Amount in Words -->
                                <?php if($grand_total > 0): ?>
                                <div class="mt-2 pt-2 border-top">
                                    <small class="text-muted"><strong>Amount in Words:</strong> <?= convertNumberToWords($grand_total) ?></small>
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Remarks and Footer -->
                <?php if(!empty($remarks)): ?>
                <div class="alert alert-info border-start border-5 border-info mt-4">
                    <div class="d-flex">
                        <i class="fas fa-sticky-note me-3 mt-1"></i>
                        <div>
                            <h6 class="alert-heading mb-1">Remarks / Notes</h6>
                            <p class="mb-0"><?= nl2br(htmlspecialchars($remarks)) ?></p>
                        </div>
                    </div>
                </div>
                <?php endif; ?>
                
                <!-- Edit History Section -->
                <?php if(!empty($last_editor_name)): ?>
                <div class="alert alert-warning border-start border-5 border-warning mt-4">
                    <div class="d-flex">
                        <i class="fas fa-history me-3 mt-1"></i>
                        <div>
                            <h6 class="alert-heading mb-1">Edit History</h6>
                            <p class="mb-1"><strong>Last Edited By:</strong> <?= htmlspecialchars($last_editor_name) ?> (<?= $last_editor_type ?>)</p>
                            <?php if(!empty($last_edited_date_display)): ?>
                            <p class="mb-0"><strong>Last Edit Date:</strong> <?= $last_edited_date_display ?></p>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
                <?php endif; ?>
                
                <div class="mt-5 pt-4 border-top text-center">
                    <div class="row">
                        <div class="col-md-4 mb-3">
                            <p class="mb-1"><strong>Authorized Signatory</strong></p>
                            <div class="border-top w-50 mx-auto pt-2"></div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <p class="mb-1"><strong>Customer Signature</strong></p>
                            <div class="border-top w-50 mx-auto pt-2"></div>
                        </div>
                        <div class="col-md-4 mb-3">
                            <p class="mb-1"><strong>Company Stamp</strong></p>
                            <div class="border rounded p-2 w-50 mx-auto">
                                <small class="text-muted">Verified & Processed</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <p class="text-muted mb-1">
                            <i class="fas fa-shield-alt me-1"></i> Goods sold are not returnable unless defective
                        </p>
                        <p class="text-muted mb-0">
                            <i class="fas fa-phone me-1"></i> For queries, contact: <?= htmlspecialchars($_settings->info('contact') ?? '9179105875') ?>
                        </p>
                        <p class="text-primary fw-bold mt-3">Thank You For Your Business! Visit Again</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card-footer bg-light d-print-none">
            <div class="d-flex justify-content-between align-items-center flex-wrap">
                <div class="mb-2 mb-md-0">
                    <span class="text-muted">
                        <i class="fas fa-history me-1"></i> 
                        Invoice Generated: <?= date("d-m-Y h:i A", strtotime($date_created ?? date('Y-m-d H:i:s'))) ?>
                        <?php if(!empty($last_edited_date_display)): ?>
                        <br><i class="fas fa-user-edit me-1"></i> 
                        Last Edited: <?= $last_edited_date_display ?>
                        <?php endif; ?>
                    </span>
                </div>
                <div class="d-flex flex-wrap">
                    <a href="../pdf/gst_bill.php?type=direct_sale&id=<?= $id ?>" target="_blank" class="btn btn-outline-success btn-sm me-2 mb-2">
                        <i class="fas fa-download me-1"></i> Download PDF
                    </a>
                    <!-- EDIT BUTTON ADDED HERE IN FOOTER TOO -->
                    <a href="./?page=direct_sales/manage_sale&id=<?= $id ?>" class="btn btn-outline-warning btn-sm me-2 mb-2">
                        <i class="fas fa-edit me-1"></i> Edit
                    </a>
               <!--        <button class="btn btn-outline-primary btn-sm mb-2" onclick="printInvoice()">
                        <i class="fas fa-print me-1"></i> Print Invoice
                    </button> -->
					<a href="./?page=direct_sales" class="btn btn-outline-success btn-sm me-2 mb-2">
                        <i class="fas fa-arrow-left me-1"></i> Back
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
@media print {
    .btn, .card-header, .card-footer, .dropdown, .d-print-none, .badge.bg-info { 
        display: none !important; 
    }
    body, html { 
        background: white !important; 
        font-size: 12pt !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        width: 100% !important;
    }
    .content, .card, .card-body { 
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
        width: 100% !important;
    }
    #print_out { 
        width: 100% !important;
        margin: 0 !important;
        padding: 20px !important;
        background: white !important;
    }
    .table {
        font-size: 10pt !important;
        margin-bottom: 15px !important;
    }
    .container-fluid {
        padding: 0 !important;
    }
    @page {
        margin: 0.5cm;
        size: A4;
    }
}

/* Company logo style - Same as client_ledger_print.php */
.company-logo { 
    max-height: 60px;
    margin-bottom: 5px;
}

/* Optional: Keep the old placeholder style for reference */
.company-logo-placeholder {
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.table th {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85rem;
}

.border-info {
    border-left-color: #0dcaf0 !important;
}

.bg-gradient-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
    .card-header .d-flex {
        flex-direction: column;
        align-items: flex-start !important;
    }
    
    .card-header .d-flex > div {
        width: 100%;
        margin-bottom: 10px;
    }
    
    .card-header .d-flex > div:last-child {
        margin-bottom: 0;
    }
    
    .table th, .table td {
        padding: 8px 5px;
        font-size: 0.85rem;
    }
    
    /* Adjust logo for mobile */
    .company-logo {
        max-height: 50px;
    }
}
</style>

<script>
// Print function
function printInvoice() {
    // First, hide all non-print elements
    var nonPrintElements = document.querySelectorAll('.d-print-none, .card-header, .card-footer, .btn');
    nonPrintElements.forEach(function(el) {
        el.style.display = 'none';
    });
    
    // Trigger print
    window.print();
    
    // Restore elements after print
    setTimeout(function() {
        nonPrintElements.forEach(function(el) {
            el.style.display = '';
        });
    }, 1000);
}

// Add filename to print like client_ledger_print.php
function printWithFilename() {
    var originalTitle = document.title;
    var invoiceCode = "<?= htmlspecialchars($sale_code ?? 'N/A') ?>";
    var currentDate = "<?= date('Y-m-d_H-i-s') ?>";
    var cleanInvoiceCode = invoiceCode.replace(/[^a-zA-Z0-9]/g, '_');
    var newTitle = "Invoice_" + cleanInvoiceCode + "_" + currentDate;
    
    document.title = newTitle;
    
    setTimeout(function() {
        window.print();
        setTimeout(function() {
            document.title = originalTitle;
        }, 1000);
    }, 100);
}
</script>