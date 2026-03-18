<?php
require_once('../../config.php');
$id = $_GET['id'];
// History fetch karein
$history = $conn->query("SELECT * FROM `mechanic_salary_history` WHERE mechanic_id = '$id' ORDER BY effective_date DESC, id DESC");
?>
<div class="container-fluid">
    <table class="table table-bordered table-sm">
        <thead>
            <tr class="bg-light">
                <th>Effective Date</th>
                <th class="text-right">Salary Rate</th>
                <th class="text-center">Action</th>
            </tr>
        </thead>
        <tbody>
            <?php while($row = $history->fetch_assoc()): ?>
            <tr id="hist_row_<?php echo $row['id'] ?>">
                <td><?php echo date("d M, Y", strtotime($row['effective_date'])) ?></td>
                <td class="text-right font-weight-bold">₹<?php echo number_format($row['salary'], 2) ?></td>
                <td class="text-center">
                    <button type="button" class="btn btn-xs btn-primary edit_h_btn" 
                            data-id="<?php echo $row['id'] ?>" 
                            data-salary="<?php echo $row['salary'] ?>" 
                            data-date="<?php echo $row['effective_date'] ?>">
                        <i class="fa fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-xs btn-danger delete_history" data-id="<?php echo $row['id'] ?>">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>
            <?php endwhile; ?>
        </tbody>
    </table>
</div>

<div id="edit_hist_wrapper" style="display:none; padding: 15px; border: 1px solid #ddd; background: #f9f9f9; margin-top: 10px; border-radius: 5px;">
    <h6><b>Edit Record</b></h6>
    <form id="edit-history-form">
        <input type="hidden" name="h_id" id="h_id">
        <div class="row">
            <div class="col-md-6">
                <div class="form-group">
                    <label class="small">Salary Amount</label>
                    <input type="number" name="h_salary" id="h_salary" class="form-control form-control-sm" required>
                </div>
            </div>
            <div class="col-md-6">
                <div class="form-group">
                    <label class="small">Effective Date</label>
                    <input type="date" name="h_date" id="h_date" class="form-control form-control-sm" required>
                </div>
            </div>
        </div>
        <div class="text-right">
            <button type="submit" class="btn btn-sm btn-success">Update</button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="$('#edit_hist_wrapper').hide()">Cancel</button>
        </div>
    </form>
</div>

<script>
    // Edit Button Click
    $('.edit_h_btn').click(function(){
        $('#h_id').val($(this).attr('data-id'));
        $('#h_salary').val($(this).attr('data-salary'));
        $('#h_date').val($(this).attr('data-date'));
        $('#edit_hist_wrapper').slideDown();
    });

    // Submit Edit Form
    $('#edit-history-form').submit(function(e){
        e.preventDefault();
        start_loader();
        $.ajax({
            url:_base_url_+"classes/Master.php?f=update_history_entry",
            method:'POST',
            data: $(this).serialize(),
            dataType:'json',
            success:function(resp){
                if(resp.status == 'success'){
                    alert_toast("History updated successfully","success");
                    setTimeout(function(){ location.reload() }, 1000);
                }else{
                    alert_toast("Error updating","error");
                }
                end_loader();
            }
        });
    });

    // Delete Logic
    $('.delete_history').click(function(){
        var _id = $(this).attr('data-id');
        if(confirm("Kya aap is record ko delete karna chahte hain?")){
            start_loader();
            $.ajax({
                url:_base_url_+"classes/Master.php?f=delete_salary_history",
                method:'POST',
                data:{id: _id},
                dataType:'json',
                success:function(resp){
                    if(resp.status == 'success'){
                        location.reload();
                    }else{
                        alert_toast("Error","error");
                        end_loader();
                    }
                }
            });
        }
    });
</script>