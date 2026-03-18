<?php
require_once('../config.php');

// 1. Validation: Check Client ID
if(!isset($_GET['id']) || !is_numeric($_GET['id'])){
    echo '<script> alert("Valid Client ID is required."); location.replace("./?page=clients"); </script>';
    exit;
}

$id = $_GET['id'];

// 2. Fetch Client Details (Prepared Statement)
$stmt_client = $conn->prepare("SELECT * FROM `client_list` WHERE id = ?");
$stmt_client->bind_param("i", $id);
$stmt_client->execute();
$res_client = $stmt_client->get_result();

if($res_client->num_rows > 0){
    $client = $res_client->fetch_assoc();
    foreach($client as $k => $v){
        if(!is_numeric($k)) $$k = $v;
    }
    $client_name_full = trim($firstname.' '.($middlename ? $middlename.' ' : '').$lastname);
} else {
    echo '<script> alert("Client not found."); location.replace("./?page=clients"); </script>';
    exit;
}
$stmt_client->close();

// 3. Fetch Accounting Summary (Original)
// A. Total Repair Billed (Status 5 = Delivered)
$stmt_billed = $conn->prepare("SELECT SUM(amount) as total FROM transaction_list WHERE client_name = ? AND status = 5");
$stmt_billed->bind_param("i", $id);
$stmt_billed->execute();
$repair_billed = $stmt_billed->get_result()->fetch_assoc()['total'] ?? 0;

// B. Total Direct Sales Billed
$stmt_sales = $conn->prepare("SELECT SUM(total_amount) as total FROM direct_sales WHERE client_id = ?");
$stmt_sales->bind_param("i", $id);
$stmt_sales->execute();
$direct_sales_billed = $stmt_sales->get_result()->fetch_assoc()['total'] ?? 0;

// Grand Total Billed (Repair + Direct Sales)
$total_billed = $repair_billed + $direct_sales_billed;

// C. Total Paid (Service Payments only – exclude loan repayments)
$stmt_paid = $conn->prepare("SELECT SUM(amount + discount) as total FROM client_payments WHERE client_id = ? AND loan_id IS NULL");
$stmt_paid->bind_param("i", $id);
$stmt_paid->execute();
$total_paid = $stmt_paid->get_result()->fetch_assoc()['total'] ?? 0;

// Original Final Balance (Service + Opening)
$final_balance = ($opening_balance + $total_billed) - $total_paid;

// 4. New Loan/Advance Summary
// Total Loan Given (active loans)
$stmt_loan = $conn->prepare("SELECT SUM(total_payable) as total_loan, SUM(emi_amount) as monthly_emi FROM client_loans WHERE client_id = ? AND status = 1");
$stmt_loan->bind_param("i", $id);
$stmt_loan->execute();
$loan_data = $stmt_loan->get_result()->fetch_assoc();
$total_loan_given = $loan_data['total_loan'] ?? 0;
$monthly_emi_total = $loan_data['monthly_emi'] ?? 0;

// Total Loan Repaid (payments linked to a loan)
$stmt_loan_paid = $conn->prepare("SELECT SUM(amount + discount) as total FROM client_payments WHERE client_id = ? AND loan_id IS NOT NULL");
$stmt_loan_paid->bind_param("i", $id);
$stmt_loan_paid->execute();
$total_loan_repaid = $stmt_loan_paid->get_result()->fetch_assoc()['total'] ?? 0;

$current_loan_balance = $total_loan_given - $total_loan_repaid;

// Overall balance including loans
$net_balance = ($opening_balance + $total_billed + $total_loan_given) - ($total_paid + $total_loan_repaid);
?>

<div class="content py-3">
    <div class="card card-outline card-primary shadow-sm">
        <div class="card-header">
            <div class="client-profile-header d-flex flex-wrap align-items-center">
                <div class="image-wrapper mr-4 mb-3 mb-md-0">
                    <img src="<?php echo validate_image($image_path) ?>"
                         alt="Client Image"
                         class="client-view-img shadow view_image_full"
                         onerror="this.src='<?php echo base_url ?>dist/img/no-image-available.png'"
                         style="width: 120px; height: 120px; object-fit: cover; border-radius: 12px; border: 3px solid #fff; cursor: pointer;"
                         data-src="<?php echo validate_image($image_path) ?>">
                </div>

                <div class="info-wrapper flex-grow-1">
                    <h3 class="card-title" style="font-size: 1.8rem; font-weight: 700; display: block; float: none; margin-bottom: 5px;">
                        <?php echo $client_name_full ?>
                    </h3>

                    <div class="text-muted mb-2">
                        <i class="fa fa-id-badge"></i> <b>ID:</b> <?php echo $id ?> |
                        <i class="fa fa-map-marker-alt text-danger"></i> <b>Address:</b> <?php echo $address ?: 'N/A' ?>
                    </div>

                    <div class="contact-badges d-flex flex-wrap" style="gap: 10px;">
                        <a href="tel:<?= $contact ?>" class="badge badge-primary p-2" title="Click to Call">
                            <i class="fa fa-phone-alt"></i> Call: <?= $contact ?>
                        </a>

                        <?php $display_wa = !empty($whatsapp_no) ? $whatsapp_no : $contact; ?>
                        <?php if($display_wa): ?>
                            <a href="https://wa.me/91<?= $display_wa ?>" target="_blank" class="badge badge-success p-2" title="Send WhatsApp Message">
                                <i class="fab fa-whatsapp"></i> WhatsApp: <?= $display_wa ?>
                            </a>
                        <?php endif; ?>

                        <?php if($email): ?>
                            <a href="mailto:<?= $email ?>" class="badge badge-info p-2" title="Send Email">
                                <i class="fa fa-envelope"></i> <?= $email ?>
                            </a>
                        <?php else: ?>
                            <span class="badge badge-secondary p-2"><i class="fa fa-envelope"></i> No Email</span>
                        <?php endif; ?>
                    </div>
                </div>
            </div>

            <style>
                /* Desktop (PC) View */
                .client-profile-header {
                    display: flex;
                    align-items: center;
                    gap: 25px;
                    padding: 10px;
                }
                .client-view-img {
                    width: 140px;
                    height: 140px;
                    object-fit: cover;
                    border-radius: 12px;
                    border: 4px solid #fff;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }

                /* Mobile View Optimization */
                @media (max-width: 768px) {
                    .client-profile-header {
                        flex-direction: column !important;
                        text-align: center !important;
                        gap: 15px !important;
                    }
                    .image-wrapper {
                        margin-right: 0 !important;
                    }
                    .client-view-img {
                        width: 120px;
                        height: 120px;
                    }
                    .info-wrapper h3 {
                        font-size: 1.5rem !important;
                    }
                    .contact-badges {
                        justify-content: center !important;
                        gap: 8px !important;
                    }
                    .card-tools {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center !important;
                        gap: 5px;
                        margin-top: 15px !important;
                        width: 100%;
                    }
                    .card-tools .btn {
                        flex: 1 1 45%;
                        font-size: 12px;
                    }
                }
                .badge:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    transition: all 0.2s;
                }
            </style>
            <style>
                .detail-label {
                    font-weight: bold;
                    color: #555;
                    min-width: 90px;
                    display: inline-block;
                }
                .detail-item {
                    margin-bottom: 3px;
                }
            </style>

            <div class="card-tools">
                <a href="./?page=clients" class="btn btn-default btn-sm border"><i class="fa fa-angle-left"></i> Back to List</a>
                <button class="btn btn-sm btn-flat btn-success" type="button" onclick="printFilteredLedger()">
                    <i class="fa fa-print"></i> Print Photo Statement
                </button>
                <a href="clients/client_ledger_print.php?id=<?= $id ?>" target="_blank" class="btn btn-warning btn-sm">
                    <i class="fa fa-print"></i> Print Full Ledger
                </a>
                <!-- Original Edit and Service Payment -->
                <button type="button" class="btn btn-primary btn-sm edit_client" data-id="<?= $id ?>"><i class="fa fa-edit"></i> Edit Details</button>
                <button type="button" class="btn btn-success btn-sm add_payment" data-client-id="<?= $id ?>">
                    <i class="fa fa-plus"></i> Add Service Payment
                </button>
                <!-- New Loan/Advance Buttons -->
                <button type="button" class="btn btn-info btn-sm add_loan" data-client-id="<?= $id ?>">
                    <i class="fa fa-hand-holding-usd"></i> Give Loan
                </button>
                <button type="button" class="btn btn-warning btn-sm collect_emi" data-client-id="<?= $id ?>">
                    <i class="fa fa-money-check-alt"></i> Collect EMI
                </button>
            </div>
        </div>

        <div class="card-body">
            <div class="container-fluid">
                <!-- Original Summary Row (4 boxes) -->
                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Opening Balance</span>
                                <span class="info-box-number text-primary">₹<?= number_format($opening_balance, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Total Billed</span>
                                <span class="info-box-number text-dark">₹<?= number_format($total_billed, 2) ?></span>
                                <small class="text-muted" style="font-size: 10px;">(Repairs + Direct Sales)</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Total Received (Service)</span>
                                <span class="info-box-number text-success">₹<?= number_format($total_paid, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text"><?= $final_balance >= 0 ? 'Due (Service)' : 'Advance (Service)' ?></span>
                                <span class="info-box-number" style="color: <?= $final_balance >= 0 ? '#dc3545' : '#28a745' ?>;">
                                    ₹ <?= number_format(abs($final_balance), 2) ?>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- New Loan Summary Row -->
                <div class="row mb-4">
                    <div class="col-md-4">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Active Loan Balance</span>
                                <span class="info-box-number text-warning">₹<?= number_format($current_loan_balance, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="info-box bg-light border">
                            <div class="info-box-content">
                                <span class="info-box-text">Monthly EMI Due</span>
                                <span class="info-box-number text-primary">₹<?= number_format($monthly_emi_total, 2) ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="info-box bg-success border">
                            <div class="info-box-content">
                                <span class="info-box-text">Total Net Balance (incl. Loans)</span>
                                <span class="info-box-number">₹<?= number_format($net_balance, 2) ?></span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Active Loans Table (New) -->
                <h4>Active Loans</h4>
                <table class="table table-sm table-bordered mb-4">
                    <thead>
                        <tr>
                            <th>Loan Date</th>
                            <th>Total Amount</th>
                            <th>Paid</th>
                            <th>Balance</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        $loan_qry = $conn->query("SELECT * FROM `client_loans` WHERE client_id = $id AND status = 1");
                        while($lrow = $loan_qry->fetch_assoc()):
                            $p_stmt = $conn->query("SELECT SUM(amount + discount) FROM client_payments WHERE loan_id = '{$lrow['id']}'");
                            $l_paid = $p_stmt->fetch_array()[0] ?? 0;
                            $l_bal = $lrow['total_payable'] - $l_paid;
                        ?>
                        <tr>
                            <td><?php echo date("M d, Y", strtotime($lrow['loan_date'])) ?></td>
                            <td>₹<?php echo number_format($lrow['total_payable'],2) ?></td>
                            <td>₹<?php echo number_format($l_paid,2) ?></td>
                            <td class="text-danger font-weight-bold">₹<?php echo number_format($l_bal,2) ?></td>
                            <td><span class="badge badge-success">Active</span></td>
                            <td>
                                <?php if($l_bal <= 0): ?>
                                    <button class="btn btn-xs btn-primary close_loan" data-id="<?php echo $lrow['id'] ?>">Close Loan</button>
                                <?php else: ?>
                                    <button class="btn btn-xs btn-outline-danger close_loan" data-id="<?php echo $lrow['id'] ?>">Force Close</button>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php endwhile; ?>
                    </tbody>
                </table>

                <!-- Tabs Section (with new Loan Payments tab) -->
                <div class="card card-tabs">
                    <div class="card-header p-0 pt-1">
                        <ul class="nav nav-tabs" id="clientTabs" role="tablist">
                            <li class="nav-item">
                                <a class="nav-link active" data-toggle="pill" href="#repairs" role="tab">
                                    <i class="fa fa-tools"></i> Repair History
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-toggle="pill" href="#direct_sales" role="tab">
                                    <i class="fa fa-shopping-cart"></i> Direct Sales
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-toggle="pill" href="#payments" role="tab">
                                    <i class="fa fa-receipt"></i> All Payments
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-toggle="pill" href="#loan_payments" role="tab">
                                    <i class="fa fa-credit-card"></i> Loan Payments
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div class="card-body">
                        <div class="row align-items-end mb-3">
                            <div class="col-md-3">
                                <label for="date_from" class="control-label">From Date</label>
                                <input type="date" id="date_from" class="form-control form-control-sm">
                            </div>
                            <div class="col-md-3">
                                <label for="date_to" class="control-label">To Date</label>
                                <input type="date" id="date_to" class="form-control form-control-sm">
                            </div>
                            <div class="col-md-4">
                                <button class="btn btn-primary btn-sm" type="button" id="filter_dates"><i class="fa fa-filter"></i> Filter</button>
                                <button class="btn btn-default btn-sm border" type="button" id="reset_filter">Reset</button>
                            </div>
                        </div>

                        <div class="tab-content">
                            <!-- Repairs Tab -->
                            <div class="tab-pane fade show active" id="repairs">
                                <table class="table table-hover table-striped table-bordered datatable">
                                    <thead class="bg-navy">
                                        <tr>
                                            <th>Date</th>
                                            <th>Job ID</th>
                                            <th>Code</th>
                                            <th>Item/Model</th>
                                            <th>Remarks</th>
                                            <th>Locate</th>
                                            <th>Status</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php
                                        $stmt_repairs = $conn->prepare("SELECT * FROM transaction_list WHERE client_name = ? ORDER BY date_created DESC");
                                        $stmt_repairs->bind_param("i", $id);
                                        $stmt_repairs->execute();
                                        $repairs = $stmt_repairs->get_result();
                                        while($row = $repairs->fetch_assoc()):
                                        ?>
                                        <tr>
                                            <td data-order="<?= date("Ymd", strtotime($row['date_created'])) ?>">
                                                <?= date("d-m-Y", strtotime($row['date_created'])) ?>
                                            </td>
                                            <td><a href="./?page=transactions/view_details&id=<?= $row['id'] ?>"><?= $row['job_id'] ?></a></td>
                                            <td><a href="./?page=transactions/view_details&id=<?= $row['id'] ?>"><?= $row['code'] ?></a></td>
                                            <td><?= $row['item'] ?></td>
                                            <td><?= $row['remark'] ?></td>
                                            <td><?= $row['uniq_id'] ?></td>
                                            <td class="text-center">
                                                <?php
                                                switch($row['status']){
                                                    case 0: echo '<span class="badge badge-secondary px-3">Pending</span>'; break;
                                                    case 1: echo '<span class="badge badge-primary px-3">On-Progress</span>'; break;
                                                    case 2: echo '<span class="badge badge-info px-3">Done</span>'; break;
                                                    case 3: echo '<span class="badge badge-success px-3">Paid</span>'; break;
                                                    case 4: echo '<span class="badge badge-danger px-3">Cancelled</span>'; break;
                                                    case 5:
                                                        echo '<span class="badge badge-warning px-3">Delivered</span>';
                                                        if(!empty($row['date_completed'])){
                                                            echo '<br><small class="text-muted" style="font-size:0.75rem;">
                                                                    <i class="fa fa-calendar-check"></i> '.date("d M Y", strtotime($row['date_completed'])).'
                                                                  </small>';
                                                        }
                                                        break;
                                                }
                                                ?>
                                            </td>
                                            <td class="text-right">₹<?= number_format($row['amount'], 2) ?></td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Direct Sales Tab -->
                            <div class="tab-pane fade" id="direct_sales">
                                <table class="table table-hover table-striped table-bordered datatable">
                                    <thead class="bg-navy">
                                        <tr>
                                            <th>Date</th>
                                            <th>Sale Code</th>
                                            <th>Payment Mode</th>
                                            <th>Remarks</th>
                                            <th>Total Amount</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php
                                        $stmt_ds = $conn->prepare("SELECT * FROM direct_sales WHERE client_id = ? ORDER BY date_created DESC");
                                        $stmt_ds->bind_param("i", $id);
                                        $stmt_ds->execute();
                                        $direct_sales = $stmt_ds->get_result();
                                        while($row = $direct_sales->fetch_assoc()):
                                        ?>
                                        <tr>
                                            <td data-order="<?= date("Ymd", strtotime($row['date_created'])) ?>">
                                                <?= date("d-m-Y", strtotime($row['date_created'])) ?>
                                            </td>
                                            <td><?= $row['sale_code'] ?></td>
                                            <td><?= $row['payment_mode'] ?></td>
                                            <td><?= $row['remarks'] ?></td>
                                            <td class="text-right text-success font-weight-bold">₹<?= number_format($row['total_amount'], 2) ?></td>
                                            <td class="text-center">
                                                <a href="./?page=direct_sales/view_sale&id=<?= $row['id'] ?>" class="btn btn-sm btn-flat btn-info">
                                                    <i class="fa fa-eye"></i> View
                                                </a>
                                            </td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>

                            <!-- All Payments Tab (existing) -->
                            <div class="tab-pane fade" id="payments">
                                <table class="table table-hover table-striped table-bordered datatable">
                                    <thead class="bg-navy">
                                        <tr>
                                            <th>Date</th>
                                            <th>Ref. ID</th>
                                            <th>Type</th>
                                            <th>Amount</th>
                                            <th>Disc.</th>
                                            <th>Net Amount</th>
                                            <th>Mode</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php
                                        $stmt_plist = $conn->prepare("SELECT * FROM client_payments WHERE client_id = ? ORDER BY payment_date DESC");
                                        $stmt_plist->bind_param("i", $id);
                                        $stmt_plist->execute();
                                        $plist = $stmt_plist->get_result();
                                        while($row = $plist->fetch_assoc()):
                                            $is_loan = !is_null($row['loan_id']);
                                        ?>
                                        <tr>
                                            <td data-order="<?= date("Ymd", strtotime($row['payment_date'])) ?>">
                                                <?= date("d-m-Y", strtotime($row['payment_date'])) ?>
                                            </td>
                                            <td>
                                                <?php
                                                $hasData = false;
                                                echo '<div class="details-container">';
                                                if (!empty($row['job_id'])) {
                                                    echo '<div class="detail-item"><span class="detail-label">Job ID:</span> ' . $row['job_id'] . '</div>';
                                                    $hasData = true;
                                                }
                                                if (!empty($row['bill_no'])) {
                                                    echo '<div class="detail-item"><span class="detail-label">Bill No:</span> ' . $row['bill_no'] . '</div>';
                                                    $hasData = true;
                                                }
                                                if (!empty($row['id'])) {
                                                    echo '<div class="detail-item"><span class="detail-label">Payment ID:</span> PAY-' . $row['id'] . '</div>';
                                                    $hasData = true;
                                                }
                                                if ($is_loan) {
                                                    echo '<div class="detail-item"><span class="detail-label">Loan ID:</span> LN-' . $row['loan_id'] . '</div>';
                                                    $hasData = true;
                                                }
                                                echo '</div>';
                                                if (!$hasData) echo 'Direct';
                                                ?>
                                            </td>
                                            <td><?= $is_loan ? '<span class="badge badge-info">EMI Repayment</span>' : '<span class="badge badge-secondary">Service Payment</span>' ?></td>
                                            <td>₹<?= number_format($row['amount'], 2) ?></td>
                                            <td>₹<?= number_format($row['discount'], 2) ?></td>
                                            <td class="font-weight-bold text-success">₹<?= number_format($row['amount'] + $row['discount'], 2) ?></td>
                                            <td><?= $row['payment_mode'] ?></td>
                                            <td class="text-center">
                                                <button type="button" class="btn btn-sm btn-info edit_payment" data-id="<?= $row['id'] ?>"><i class="fa fa-edit"></i></button>
                                                <button type="button" class="btn btn-sm btn-danger delete_payment" data-id="<?= $row['id'] ?>"><i class="fa fa-trash"></i></button>
                                            </td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>

                            <!-- New Loan Payments Tab -->
                            <div class="tab-pane fade" id="loan_payments">
                                <table class="table table-hover table-striped table-bordered datatable" id="loan_payments_table">
                                    <thead class="bg-navy">
                                        <tr>
                                            <th>Date</th>
                                            <th>Loan ID</th>
                                            <th>Amount</th>
                                            <th>Discount</th>
                                            <th>Net Amount</th>
                                            <th>Mode</th>
                                            <th>Remarks</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php
                                        $stmt_loan_plist = $conn->prepare("SELECT * FROM client_payments WHERE client_id = ? AND loan_id IS NOT NULL ORDER BY payment_date DESC");
                                        $stmt_loan_plist->bind_param("i", $id);
                                        $stmt_loan_plist->execute();
                                        $loan_plist = $stmt_loan_plist->get_result();
                                        while($row = $loan_plist->fetch_assoc()):
                                        ?>
                                        <tr>
                                            <td data-order="<?= date("Ymd", strtotime($row['payment_date'])) ?>">
                                                <?= date("d-m-Y", strtotime($row['payment_date'])) ?>
                                            </td>
                                            <td>
                                                <a href="./?page=loans/view&id=<?= $row['loan_id'] ?>" target="_blank">
                                                    LN-<?= str_pad($row['loan_id'], 5, '0', STR_PAD_LEFT) ?>
                                                </a>
                                            </td>
                                            <td class="text-right">₹<?= number_format($row['amount'], 2) ?></td>
                                            <td class="text-right">₹<?= number_format($row['discount'], 2) ?></td>
                                            <td class="text-right text-success">₹<?= number_format($row['amount'] + $row['discount'], 2) ?></td>
                                            <td><?= $row['payment_mode'] ?></td>
                                            <td><?= $row['remarks'] ?></td>
                                            <td class="text-center">
                                                <button type="button" class="btn btn-sm btn-info edit_payment" data-id="<?= $row['id'] ?>"><i class="fa fa-edit"></i></button>
                                                <button type="button" class="btn btn-sm btn-danger delete_payment" data-id="<?= $row['id'] ?>"><i class="fa fa-trash"></i></button>
                                            </td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Original Payment Modal (Service) -->
<div class="modal fade" id="paymentModal" tabindex="-1">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Record New Service Payment</h5>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>
            <form action="clients/save_payment.php" method="POST">
                <div class="modal-body">
                    <input type="hidden" name="client_id" value="<?= $id ?>">
                    <div class="row">
                        <div class="col-md-3 form-group">
                            <label>Amount Received</label>
                            <input type="number" step="any" name="amount" class="form-control" required>
                        </div>
                        <div class="col-md-3 form-group">
                            <label for="payment_date" class="control-label">Receiving Date</label>
                            <input type="date" name="payment_date" id="payment_date" class="form-control form-control-sm rounded-0" value="<?php echo date('Y-m-d') ?>" required>
                        </div>
                        <div class="col-md-3 form-group">
                            <label>Discount (if any)</label>
                            <input type="number" step="any" name="discount" class="form-control" value="0">
                        </div>
                        <div class="col-md-3 form-group">
                            <label>Payment Mode</label>
                            <select name="payment_mode" class="form-control" required>
                                <option>Cash</option>
                                <option>PhonePe/GPay</option>
                                <option>Bank Transfer</option>
                            </select>
                        </div>
                        <div class="col-md-12 form-group">
                            <label>Remarks</label>
                            <textarea name="remarks" class="form-control" rows="2"></textarea>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">Save Payment</button>
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                </div>
            </form>
        </div>
    </div>
</div>

<!-- Image Preview Modal -->
<div class="modal fade" id="imagePreviewModal" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="background: transparent; border: none;">
            <div class="modal-body text-center">
                <button type="button" class="close" data-dismiss="modal" style="color: #fff; font-size: 2rem; position: absolute; right: 10px; top: -40px;">&times;</button>
                <img src="" id="preview-img" class="img-fluid rounded shadow-lg" style="max-height: 80vh;">
            </div>
        </div>
    </div>
</div>

<style>
    /* Active Tab background and text color */
    .nav-tabs .nav-link.active {
        background-color: #007bff !important;
        color: #ffffff !important;
        border-color: #007bff #007bff #fff !important;
        font-weight: bold;
    }
    /* Modern Profile Image Style */
    .client-profile-header {
        display: flex;
        align-items: center;
        gap: 25px;
        padding: 10px;
        background: #fff;
    }
    .client-view-img {
        width: 120px;
        height: 120px;
        object-fit: cover;
        border-radius: 12px;
        border: 4px solid #fff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    }
    @media (max-width: 768px) {
        .client-profile-header {
            flex-direction: column;
            text-align: center;
        }
    }

    .nav-tabs .nav-link:hover {
        background-color: #f8f9fa;
        border-color: #dee2e6;
    }

    .tab-content {
        border: 1px solid #dee2e6;
        border-top: none;
        padding: 20px;
        background: #fff;
    }
</style>

<script>
function printFilteredLedger() {
    var from = $('#date_from').val();
    var to = $('#date_to').val();
    var client_id = '<?= $id ?>';
    var url = 'clients/client_ledger_print_photo.php?id=' + client_id;
    if (from) url += '&from=' + from;
    if (to) url += '&to=' + to;
    window.open(url, "_blank", "width=1000,height=800");
}

$(function(){
    // Initialize DataTables for all four tables
    var repairTable = $('#repairs table').DataTable({ "order": [[0, "desc"]] });
    var salesTable = $('#direct_sales table').DataTable({ "order": [[0, "desc"]] });
    var paymentTable = $('#payments table').DataTable({ "order": [[0, "desc"]] });
    var loanPaymentTable = $('#loan_payments table').DataTable({ "order": [[0, "desc"]] });

    // Custom date filter
    $.fn.dataTable.ext.search.push(function(settings, data, dataIndex) {
        var from = $('#date_from').val();
        var to = $('#date_to').val();
        var dateParts = data[0].split("-");
        if(dateParts.length !== 3) return true;
        var rowDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
        var min = from ? new Date(from) : null;
        var max = to ? new Date(to) : null;
        if (min) min.setHours(0,0,0,0);
        if (max) max.setHours(23,59,59,999);
        if (
            (min === null && max === null) ||
            (min === null && rowDate <= max) ||
            (min <= rowDate && max === null) ||
            (min <= rowDate && rowDate <= max)
        ) return true;
        return false;
    });

    $('#filter_dates').click(function(){
        repairTable.draw();
        salesTable.draw();
        paymentTable.draw();
        loanPaymentTable.draw();
    });

    $('#reset_filter').click(function(){
        $('#date_from').val('');
        $('#date_to').val('');
        repairTable.draw();
        salesTable.draw();
        paymentTable.draw();
        loanPaymentTable.draw();
    });

    // Original actions
    $('.edit_client').click(function(){
        uni_modal("<i class='fa fa-edit'></i> Edit Client Details", "clients/edit_client.php?id=" + $(this).attr('data-id'), 'mid-large');
    });

    // Service payment (original)
    $('.add_payment').click(function(){
        uni_modal("Record New Service Payment", "clients/edit_payment.php?client_id=" + $(this).attr('data-client-id'));
    });

    // New loan actions
    $('.add_loan').click(function(){
        uni_modal("Give New Loan/Advance", "clients/manage_loan.php?client_id=" + $(this).attr('data-client-id'));
    });

    $('.collect_emi').click(function(){
        uni_modal("Collect EMI / Loan Payment", "clients/manage_payment.php?client_id=" + $(this).attr('data-client-id'));
    });

    $('.edit_payment').click(function(){
        var _id = $(this).data('id');
        uni_modal("Edit Payment Details", "clients/edit_payment.php?id=" + _id);
    });

    $('.delete_payment').click(function(){
        var _id = $(this).data('id');
        if(confirm("Are you sure you want to delete this payment record?")){
            location.href = "clients/delete_payment.php?id=" + _id;
        }
    });

    $('.view_image_full').click(function(){
        var imgPath = $(this).attr('data-src');
        $('#preview-img').attr('src', imgPath);
        $('#imagePreviewModal').modal('show');
    });

    // New: Close loan functionality
    $('.close_loan').click(function(){
        _conf("Are you sure to close this loan?", "close_loan", [$(this).attr('data-id')])
    });
});

function close_loan($id){
    start_loader();
    $.ajax({
        url:_base_url_+"classes/Master.php?f=close_loan",
        method:"POST",
        data:{id:$id},
        dataType:"json",
        error:err=>{
            console.log(err)
            alert_toast("An error occured.",'error');
            end_loader();
        },
        success:function(resp){
            if(typeof resp== 'object' && resp.status == 'success'){
                location.reload();
            }else{
                alert_toast("An error occured.",'error');
                end_loader();
            }
        }
    });
}
</script>