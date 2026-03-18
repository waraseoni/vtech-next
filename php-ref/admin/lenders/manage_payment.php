<?php
require_once('../../config.php');
if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT * from `loan_payments` where id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ $$k=$v; }
    }
}
$lender_id = isset($_GET['lender_id']) ? $_GET['lender_id'] : (isset($lender_id) ? $lender_id : '');
?>
<div class="container-fluid">
    <form action="" id="loan-payment-form">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        <input type="hidden" name="lender_id" value="<?php echo $lender_id ?>">
        
        <div class="form-group">
            <label for="payment_date" class="control-label">Payment Date</label>
            <input type="date" name="payment_date" id="payment_date" class="form-control form-control-sm rounded-0" value="<?php echo isset($payment_date) ? $payment_date : date('Y-m-d'); ?>" required>
        </div>
        
        <div class="form-group">
            <label for="amount_paid" class="control-label">Amount Paid (EMI)</label>
            <input type="number" step="any" name="amount_paid" id="amount_paid" class="form-control form-control-sm rounded-0 text-right" value="<?php echo isset($amount_paid) ? $amount_paid : ''; ?>" required>
        </div>

        <div class="form-group">
            <label for="remarks" class="control-label">Remarks/Note</label>
            <textarea name="remarks" id="remarks" rows="3" class="form-control form-control-sm rounded-0" placeholder="Cheque No. or Cash details..."><?php echo isset($remarks) ? $remarks : ''; ?></textarea>
        </div>
    </form>
</div>

<script>
    $(function(){
        $('#loan-payment-form').submit(function(e){
            e.preventDefault();
            start_loader();
            $.ajax({
                url:_base_url_+"classes/Master.php?f=save_loan_payment",
                data: new FormData($(this)[0]),
                cache: false, contentType: false, processData: false, method: 'POST', type: 'POST', dataType: 'json',
                success:function(resp){
                    if(resp.status == 'success'){
                        location.reload();
                    }else{
                        alert_toast("An error occured",'error');
                        end_loader();
                    }
                }
            })
        })
    })
</script>