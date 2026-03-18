<?php
require_once('../../config.php');

// Client ID aur Existing Payment ID check karna
if(isset($_GET['client_id'])){
    $client_id = $_GET['client_id'];
}
if(isset($_GET['id'])){
    $qry = $conn->query("SELECT * FROM `client_payments` where id = '{$_GET['id']}'");
    if($qry->num_rows > 0){
        $res = $qry->fetch_array();
        foreach($res as $k => $v){
            if(!is_numeric($k)) $$k = $v;
        }
    }
}
?>
<div class="container-fluid">
    <form action="" id="payment-form">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        <input type="hidden" name="client_id" value="<?php echo isset($client_id) ? $client_id : (isset($client_id) ? $client_id : '') ?>">

        <div class="form-group">
            <label for="payment_date" class="control-label">Payment Date</label>
            <input type="date" name="payment_date" id="payment_date" class="form-control" value="<?php echo isset($payment_date) ? $payment_date : date('Y-m-d') ?>" required>
        </div>

        <div class="form-group">
            <label for="loan_id" class="control-label">Payment Type / Select Loan</label>
            <select name="loan_id" id="loan_id" class="form-control select2">
                <option value="">--- Normal Service/Bill Payment ---</option>
                <?php 
                $loans = $conn->query("SELECT id, principal_amount, total_payable, emi_amount FROM `client_loans` WHERE client_id = '{$client_id}' AND status = 1");
                while($lrow = $loans->fetch_assoc()):
                    // Kitna pay ho chuka hai is loan ke liye
                    $paid = $conn->query("SELECT SUM(net_amount) FROM client_payments WHERE loan_id = '{$lrow['id']}'")->fetch_array()[0] ?? 0;
                    $balance = $lrow['total_payable'] - $paid;
                ?>
                <option value="<?php echo $lrow['id'] ?>" data-emi="<?php echo $lrow['emi_amount'] ?>" <?php echo isset($loan_id) && $loan_id == $lrow['id'] ? "selected" : "" ?>>
                    Loan ID: <?php echo $lrow['id'] ?> (Bal: ₹<?php echo number_format($balance,2) ?>) - EMI: ₹<?php echo number_format($lrow['emi_amount'],2) ?>
                </option>
                <?php endwhile; ?>
            </select>
            <small class="text-info">Yadi kist (EMI) jama karni hai toh loan select karein, warna khali chhodein.</small>
        </div>

        <div class="form-group">
            <label for="net_amount" class="control-label">Amount Paid (Jama Rakam)</label>
            <input type="number" step="any" name="net_amount" id="net_amount" class="form-control text-right" value="<?php echo isset($net_amount) ? $net_amount : '' ?>" required>
        </div>

        <div class="form-group">
            <label for="payment_mode" class="control-label">Payment Mode</label>
            <select name="payment_mode" id="payment_mode" class="form-control" required>
                <option <?php echo isset($payment_mode) && $payment_mode == 'Cash' ? "selected" : "" ?>>Cash</option>
                <option <?php echo isset($payment_mode) && $payment_mode == 'Online' ? "selected" : "" ?>>Online</option>
                <option <?php echo isset($payment_mode) && $payment_mode == 'Cheque' ? "selected" : "" ?>>Cheque</option>
            </select>
        </div>

        <div class="form-group">
            <label for="remarks" class="control-label">Remarks / Note</label>
            <textarea name="remarks" id="remarks" rows="2" class="form-control"><?php echo isset($remarks) ? $remarks : '' ?></textarea>
        </div>
    </form>
</div>

<script>
    $(function(){
        // Jab koi loan select kare toh auto-fill EMI amount
        $('#loan_id').change(function(){
            var emi = $(this).find(':selected').attr('data-emi');
            if(emi > 0){
                $('#net_amount').val(emi);
                $('#remarks').val("Monthly EMI Payment");
            }else{
                $('#net_amount').val('');
                $('#remarks').val("");
            }
        });

        $('#payment-form').submit(function(e){
            e.preventDefault();
            var _this = $(this);
            $('.err-msg').remove();
            start_loader();
            $.ajax({
                url: _base_url_ + "classes/Master.php?f=save_client_payment", // Purana wala function hi use hoga
                data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                type: 'POST',
                dataType: 'json',
                error: err => {
                    console.log(err);
                    alert_toast("An error occurred", 'error');
                    end_loader();
                },
                success: function(resp){
                    if(typeof resp == 'object' && resp.status == 'success'){
                        location.reload();
                    } else {
                        alert_toast("An error occurred", 'error');
                        end_loader();
                    }
                }
            })
        })
    })
</script>