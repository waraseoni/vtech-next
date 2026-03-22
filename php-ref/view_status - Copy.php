<?php 
if(isset($_GET['code'])){
    $qry = $conn->query("SELECT r.*,CONCAT(c.firstname,' ',COALESCE(c.middlename,' '),c.lastname) as client,
                            c.contact
                            FROM `transaction_list` r 
                            INNER JOIN client_list c ON r.client_name = c.id 
                            WHERE r.code = '{$_GET['code']}'");
    if($qry->num_rows > 0){
        $res = $qry->fetch_array();
        foreach($res as $k => $v){
            if(!is_numeric($k)){
                $$k = $v;
            }
        }

        $status_arr = [
            0 => ["Pending", "Kaam shuru nahi hua hai", "warning"],
            1 => ["On-Progress", "Kaam chal raha hai", "primary"],
            2 => ["Done", "Kaam pura ho gaya hai", "info"],
            3 => ["Paid", "Payment ho chuka hai", "success"],
            4 => ["Cancelled", "Transaction radd ho gaya", "danger"],
            5 => ["Delivered", "Aapko item mil chuka hai", "success"]
        ];
        $status_data = $status_arr[$status] ?? ["Unknown", "Status unknown", "secondary"];
        list($status_label, $status_hindi, $status_color) = $status_data;
    } else {
        echo "<script>alert('Unknown Transaction Code'); location.replace('./');</script>";
        exit;
    }
} else {
    echo "<script>alert('Transaction Code is required'); location.replace('./');</script>";
    exit;
}
?>

<div class="content py-3">
    <div class="container-fluid">
        <div class="card shadow rounded border-0 overflow-hidden">
            <!-- Compact Header -->
            <div class="card-header bg-gradient-navy text-white py-3 text-center">
                <h4 class="mb-0 font-weight-bold">
                    <i class="fa fa-receipt mr-2"></i>
                    Status - <?= $job_id ?> (<?= $code ?>)
                </h4>
                <small class="opacity-90">Namaste <?= ucwords($client) ?> ji</small>
            </div>

            <div class="card-body p-3">
                <div class="row">
                    <!-- Left Side -->
                    <div class="col-lg-8">
                        <!-- Job Info Compact -->
                        <div class="card border-0 shadow-sm rounded mb-3 bg-light">
                            <div class="card-body p-3">
                                <h6 class="text-navy font-weight-bold mb-2">
                                    <i class="fa fa-info-circle mr-2"></i> Job Details
                                </h6>
                                <div class="row small">
                                    <div class="col-6">
                                        <p class="mb-1"><b>Client:</b> <?= ucwords($client) ?></p>
                                        <p class="mb-1"><b>Job No:</b> <?= $job_id ?></p>
                                        <p class="mb-1"><b>Code:</b> <?= $code ?></p>
                                    </div>
                                    <div class="col-6">
                                        <p class="mb-1"><b>Item:</b> <?= ucwords($item) ?></p>
                                        <p class="mb-1"><b>Fault:</b> <?= ucwords($fault) ?></p>
                                        <?php if(!empty($remark)): ?>
                                        <p class="mb-0"><b>Remark:</b> <?= nl2br($remark) ?></p>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Services Compact -->
                        <?php 
                        $services = $conn->query("SELECT ts.*, s.name as service_name FROM transaction_services ts INNER JOIN service_list s ON ts.service_id = s.id WHERE ts.transaction_id = '$id'");
                        if($services && $services->num_rows > 0):
                        ?>
                        <div class="card border-0 shadow-sm rounded mb-3 bg-light">
                            <div class="card-body p-3">
                                <h6 class="text-primary font-weight-bold mb-2">
                                    <i class="fa fa-wrench mr-2"></i> Services
                                </h6>
                                <table class="table table-sm table-borderless mb-0">
                                    <tbody>
                                        <?php while($row = $services->fetch_assoc()): ?>
                                        <tr>
                                            <td class="font-weight-medium"><?= $row['service_name'] ?></td>
                                            <td class="text-right text-primary font-weight-bold">₹<?= number_format($row['price'], 2) ?></td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <?php endif; ?>

                        <!-- Products Compact -->
                        <?php 
                        $products = $conn->query("SELECT tp.*, p.name as product_name FROM transaction_products tp INNER JOIN product_list p ON tp.product_id = p.id WHERE tp.transaction_id = '$id'");
                        if($products && $products->num_rows > 0):
                        ?>
                        <div class="card border-0 shadow-sm rounded mb-3 bg-light">
                            <div class="card-body p-3">
                                <h6 class="text-success font-weight-bold mb-2">
                                    <i class="fa fa-box mr-2"></i> Products
                                </h6>
                                <table class="table table-sm table-borderless mb-0">
                                    <tbody>
                                        <?php while($row = $products->fetch_assoc()): 
                                            $row_total = $row['qty'] * $row['price'];
                                        ?>
                                        <tr>
                                            <td class="font-weight-medium"><?= $row['product_name'] ?></td>
                                            <td class="text-center"><?= $row['qty'] ?></td>
                                            <td class="text-right text-success font-weight-bold">₹<?= number_format($row_total, 2) ?></td>
                                        </tr>
                                        <?php endwhile; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <?php endif; ?>
                    </div>

                    <!-- Right Side Compact -->
                    <div class="col-lg-4">
                        <!-- Status Badge Compact -->
                        <div class="card border-0 shadow rounded mb-3 text-center py-4 bg-light">
                            <div class="card-body p-3">
                                <h6 class="text-muted mb-3">Current Status</h6>
                                <div class="badge badge-<?= $status_color ?> p-3 rounded-pill shadow" style="font-size: 1.5rem;">
                                    <i class="fa fa-<?= $status == 0 ? 'clock' : ($status == 1 ? 'spinner fa-spin' : ($status == 2 ? 'check-circle' : ($status == 3 ? 'rupee-sign' : ($status == 4 ? 'times-circle' : 'truck')))) ?> mr-2"></i>
                                    <?= $status_label ?>
                                </div>
                                <p class="mt-3 small font-weight-bold text-dark">
                                    <?= $status_hindi ?>
                                </p>
                            </div>
                        </div>

                        <!-- Amount Compact -->
                        <div class="card border-0 shadow rounded bg-gradient-success text-white mb-3">
                            <div class="card-body text-center py-4">
                                <h6 class="opacity-90 mb-2">Total Amount</h6>
                                <h3 class="font-weight-bold mb-0">₹<?= number_format($amount, 2) ?></h3>
                            </div>
                        </div>

                        <!-- Back Button Compact -->
                        <a href="./?p=check_status" class="btn btn-outline-primary btn-block rounded-pill">
                            <i class="fa fa-angle-left mr-2"></i> Back
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Compact & Clean Style -->
<style>
    body {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }
    .card {
        border-radius: 12px !important;
    }
    .bg-gradient-navy {
        background: linear-gradient(135deg, #001f3f, #003366) !important;
    }
    .bg-gradient-success {
        background: linear-gradient(135deg, #28a745, #20c997) !important;
    }
    .bg-light {
        background: #f8f9fa !important;
    }
    .badge {
        box-shadow: 0 6px 15px rgba(0,0,0,0.2);
    }
    .text-navy {
        color: #001f3f !important;
    }
    .small {
        font-size: 0.875rem;
    }
</style>