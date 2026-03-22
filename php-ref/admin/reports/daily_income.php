<?php include '../config.php'; ?>
<?php include '../inc/header.php'; ?>
<h2>Daily & Monthly Income Report</h2>
<div class="row">
    <div class="col-md-6">
        <div class="card dashboard-card">
            <div class="card-body text-white">
                <h4>Aaj ka Total</h4>
                <h2>₹<?php 
                    $today = date('Y-m-d');
                    $res = $conn->query("SELECT SUM(amount) as total FROM transaction_list WHERE date(date_delivery) = '$today' AND status=5");
                    echo number_format($res->fetch_array()['total'] ?? 0);
                ?></h2>
            </div>
        </div>
    </div>
    <div class="col-md-6">
        <div class="card" style="background:#28a745;color:white;">
            <div class="card-body">
                <h4>Is Mahine ka Total</h4>
                <h2>₹<?php 
                    $month = date('Y-m');
                    $res = $conn->query("SELECT SUM(amount) as total FROM transaction_list WHERE date_format(date_delivery,'%Y-%m') = '$month' AND status=5");
                    echo number_format($res->fetch_array()['total'] ?? 0);
                ?></h2>
            </div>
        </div>
    </div>
</div>
<?php include '../inc/footer.php'; ?>