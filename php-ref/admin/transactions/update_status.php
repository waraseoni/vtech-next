<?php
require_once('../../config.php');
if(isset($_GET['id'])){
    $qry = $conn->query("SELECT * FROM `transaction_list` where id = '{$_GET['id']}'");
    if($qry->num_rows > 0){
        $res = $qry->fetch_array();
        foreach($res as $k => $v){
            $$k = $v;
        }
    }
}
?>
<div class="container-fluid">
    <form action="" id="update_transaction_status">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        
        <div class="form-group">
            <label for="status" class="control-label">Status</label>
            <select name="status" id="status" class="custom-select custom-select-sm">
                <option value="0" <?php echo isset($status) && $status == 0 ? 'selected' : '' ?>>Pending</option>
                <option value="1" <?php echo isset($status) && $status == 1 ? 'selected' : '' ?>>On-Progress</option>
                <option value="2" <?php echo isset($status) && $status == 2 ? 'selected' : '' ?>>Done</option>
                <option value="3" <?php echo isset($status) && $status == 3 ? 'selected' : '' ?>>Paid</option>
                <option value="4" <?php echo isset($status) && $status == 4 ? 'selected' : '' ?>>Cancelled</option>
                <option value="5" <?php echo isset($status) && $status == 5 ? 'selected' : '' ?>>Delivered</option>
            </select>
        </div>

        <div class="form-group" id="delivery_date_div" style="display:none;">
            <label for="date_completed" class="control-label">Delivery Date & Time</label>
            <input type="datetime-local" name="date_completed" id="date_completed" class="form-control form-control-sm" 
                   value="<?php echo isset($date_completed) && !empty($date_completed) ? date('Y-m-d\TH:i', strtotime($date_completed)) : date('Y-m-d\TH:i'); ?>">
        </div>

    </form>
</div>
<script>
    $(function(){
        // Logic to show/hide date field based on status
        function checkStatus(){
            var stat = $('#status').val();
            if(stat == '5'){ // If Delivered
                $('#delivery_date_div').slideDown();
            }else{
                $('#delivery_date_div').slideUp();
            }
        }

        // Run on load and on change
        checkStatus();
        $('#status').change(function(){
            checkStatus();
        });

        // Submit Form
        $('#update_transaction_status').submit(function(e){
            e.preventDefault();
            start_loader();
            $.ajax({
                url:_base_url_+"classes/Master.php?f=update_transaction_status",
                method:"POST",
                data:$(this).serialize(),
                dataType:"json",
                success:function(resp){
                    if(resp.status == 'success'){
                        location.reload();
                    }else{
                        alert_toast("An error occurred",'error');
                        end_loader();
                    }
                }
            })
        })
    })
</script>