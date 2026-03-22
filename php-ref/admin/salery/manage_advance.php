<?php
require_once('../../config.php');

// Agar hum kisi existing payment ko edit kar rahe hain
if(isset($_GET['id'])){
    $qry = $conn->query("SELECT * FROM advance_payments where id = '{$_GET['id']}'");
    foreach($qry->fetch_array() as $k => $v){ $$k = $v; }
}

// Agar hum Mechanic View page se "Add Payment" daba rahe hain, toh wahan se mechanic_id milegi
if(isset($_GET['mechanic_id'])){
    $mechanic_id_from_url = $_GET['mechanic_id'];
}
?>
<div class="container-fluid">
    <form id="advance-form">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        
        <div class="form-group">
            <label>Staff Member</label>
            <select name="mechanic_id" class="form-control select2" required>
                <option value="" disabled selected>Select Staff</option>
                <?php 
                $staff = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE status = 1 ORDER BY name ASC");
                while($row = $staff->fetch_assoc()): 
                    // Logic: Ya toh database se aayi ID match ho (Edit case) YA phir URL se aayi ID match ho (Add case)
                    $is_selected = '';
                    if(isset($mechanic_id) && $mechanic_id == $row['id']){
                        $is_selected = 'selected';
                    } elseif(isset($mechanic_id_from_url) && $mechanic_id_from_url == $row['id']){
                        $is_selected = 'selected';
                    }
                ?>
                <option value="<?= $row['id'] ?>" <?= $is_selected ?>><?= $row['name'] ?></option>
                <?php endwhile; ?>
            </select>
        </div>

        <div class="form-group">
            <label>Amount (₹)</label>
            <input type="number" name="amount" class="form-control text-right" value="<?= isset($amount) ? $amount : '' ?>" required>
        </div>
        
        <div class="form-group">
            <label>Date Paid</label>
            <input type="date" name="date_paid" class="form-control" value="<?= isset($date_paid) ? $date_paid : date('Y-m-d') ?>" required>
        </div>
        
        <div class="form-group">
            <label>Reason/Note</label>
            <textarea name="reason" class="form-control" rows="2"><?= isset($reason) ? $reason : '' ?></textarea>
        </div>
    </form>
</div>

<script>
    $(function(){
        // Agar aapke paas select2 plugin hai toh use initialize karein, nahi toh ye line hata dein
        if($('.select2').length > 0){
            $('.select2').select2({
                placeholder:"Select Staff",
                width: "100%"
            })
        }

        $('#advance-form').submit(function(e){
            e.preventDefault();
            start_loader();
            $.ajax({
                url: _base_url_ + "classes/Master.php?f=save_advance",
                method: 'POST',
                data: $(this).serialize(),
                dataType: 'json',
                error: err => {
                    console.log(err);
                    alert_toast("An error occurred while saving", 'error');
                    end_loader();
                },
                success: function(resp){
                    if(resp.status == 'success'){
                        alert_toast("Payment Saved Successfully", 'success');
                        setTimeout(function(){
                            location.reload();
                        }, 1000);
                    } else {
                        alert_toast("Error saving entry", 'error');
                        end_loader();
                    }
                }
            })
        })
    })
</script>