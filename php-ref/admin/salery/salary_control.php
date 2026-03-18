<?php if($_settings->chk_flashdata('success')): ?>
<script>
	alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>

<div class="card card-outline card-navy shadow">
	<div class="card-header">
		<h3 class="card-title font-weight-bold"><i class="fas fa-hand-holding-usd mr-2"></i> Salary Rate Master</h3>
	</div>
	<div class="card-body">
		<div class="container-fluid">
        <table class="table table-bordered table-striped" id="salary-list">
            <colgroup>
                <col width="5%">
                <col width="35%">
                <col width="20%">
                <col width="20%">
                <col width="20%">
            </colgroup>
            <thead>
                <tr class="bg-navy text-white">
                    <th class="text-center">#</th>
                    <th>Staff Name</th>
                    <th class="text-right">Current Daily Wage</th>
                    <th class="text-center">Last Updated</th>
                    <th class="text-center">Action</th>
                </tr>
            </thead>
            <tbody>
                <?php 
                $i = 1;
                $qry = $conn->query("SELECT * FROM `mechanic_list` where status = 1 order by firstname asc");
                while($row = $qry->fetch_assoc()):
                    // History se aakhri update date nikaalein
                    $history = $conn->query("SELECT date_created FROM `mechanic_salary_history` where mechanic_id = '{$row['id']}' order by id desc limit 1")->fetch_array();
                    $last_upd = $history ? date("d M, Y", strtotime($history['date_created'])) : "N/A";
                ?>
                    <tr>
                        <td class="text-center"><?php echo $i++; ?></td>
                        <td>
                            <p class="m-0 font-weight-bold"><?php echo $row['firstname'].' '.$row['lastname'] ?></p>
                            <small class="text-muted"><?php echo $row['designation'] ?></small>
                        </td>
                        <td class="text-right font-weight-bold text-success">
                            ₹<?php echo number_format($row['daily_salary'], 2) ?>
                        </td>
                        <td class="text-center"><?php echo $last_upd ?></td>
                        <td class="text-center">
                            <button type="button" class="btn btn-sm btn-flat btn-primary update_salary" data-id="<?php echo $row['id'] ?>" data-name="<?php echo $row['firstname'].' '.$row['lastname'] ?>" data-salary="<?php echo $row['daily_salary'] ?>">
                                <i class="fas fa-edit"></i> Update
                            </button>
                            <button type="button" class="btn btn-sm btn-flat btn-info view_history" data-id="<?php echo $row['id'] ?>" data-name="<?php echo $row['firstname'].' '.$row['lastname'] ?>">
                                <i class="fas fa-history"></i> History
                            </button>
                        </td>
                    </tr>
                <?php endwhile; ?>
            </tbody>
        </table>
		</div>
	</div>
</div>

<div class="modal fade" id="salary_modal" role='dialog'>
    <div class="modal-dialog modal-md" role="document">
        <div class="modal-content">
            <div class="modal-header bg-navy">
                <h5 class="modal-title">Update Salary Rate</h5>
                <button type="button" class="close text-white" data-dismiss="modal">&times;</button>
            </div>
            <form id="salary-form">
                <div class="modal-body">
                    <input type="hidden" name="id">
                    <div class="form-group">
                        <label>Staff Name</label>
                        <input type="text" id="m_name" class="form-control border-0 font-weight-bold" readonly>
                    </div>
                    <div class="form-group">
                        <label>New Daily Wage (₹)</label>
                        <input type="number" name="new_salary" id="new_salary" step="any" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Effective Date (Kab se lagu hoga?)</label>
                        <input type="date" name="effective_date" id="effective_date" class="form-control" value="<?php echo date('Y-m-d') ?>" required>
                        <small class="text-muted">Pichli date select karein agar salary pehle se badhi hai.</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary btn-flat">Save Rate</button>
                    <button type="button" class="btn btn-secondary btn-flat" data-dismiss="modal">Cancel</button>
                </div>
            </form>
        </div>
    </div>
</div>

<script>
	$(document).ready(function(){
		$('.update_salary').click(function(){
            $('#salary-form [name="id"]').val($(this).attr('data-id'))
            $('#m_name').val($(this).attr('data-name'))
            $('#new_salary').val($(this).attr('data-salary'))
            $('#salary_modal').modal('show')
		})

        $('.view_history').click(function(){
            uni_modal("Salary History of "+$(this).attr('data-name'), "mechanics/view_salary_history.php?id="+$(this).attr('data-id'))
        })

        $('#salary-form').submit(function(e){
            e.preventDefault();
            start_loader();
            $.ajax({
                url:_base_url_+"classes/Master.php?f=update_salary_rate",
                method:'POST',
                data:$(this).serialize(),
                dataType:'json',
                error:err=>{
                    console.log(err)
                    alert_toast("An error occured",'error');
                    end_loader();
                },
                success:function(resp){
                    if(resp.status == 'success'){
                        location.reload();
                    }else{
                        alert_toast(resp.msg,'error');
                        end_loader();
                    }
                }
            })
        })
	})
</script>