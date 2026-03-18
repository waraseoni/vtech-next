<DOCUMENT filename="salary_management.php">
<?php 
if($_settings->chk_flashdata('success')): 
?>
<script>
	alert_toast("<?php echo $_settings->flashdata('success') ?>",'success')
</script>
<?php endif;?>

<div class="card card-outline card-navy shadow">
	<div class="card-header">
		<h3 class="card-title font-weight-bold"><i class="fas fa-hand-holding-usd mr-2"></i> Salary Management</h3>
	</div>
	<div class="card-body">
		<div class="container-fluid">
			<ul class="nav nav-tabs" id="salaryTabs" role="tablist">
				<li class="nav-item">
					<a class="nav-link active" id="report-tab" data-toggle="tab" href="#report" role="tab">Salary Report</a>
				</li>
				<li class="nav-item">
					<a class="nav-link" id="control-tab" data-toggle="tab" href="#control" role="tab">Salary Rate Master</a>
				</li>
			</ul>
			<div class="tab-content" id="salaryTabsContent">
				<div class="tab-pane fade show active" id="report" role="tabpanel">
					<?php 
					$month = isset($_GET['month']) ? $_GET['month'] : date("Y-m");
					$days_in_month = date("t", strtotime($month));
					$month_text = date("F Y", strtotime($month));

					// Navigation dates
					$prev_month = date('Y-m', strtotime($month . " -1 month"));
					$next_month = date('Y-m', strtotime($month . " +1 month"));
					$prev_month_end = date('Y-m-t', strtotime($month . " -1 month"));
					?>

					<style>
						.bg-navy { background-color: #001f3f !important; color: #fff; }
						.text-navy { color: #001f3f !important; }
						.month-nav-container {
							display: flex; align-items: center; justify-content: center; gap: 10px;
							background: #f4f6f9; padding: 10px; border-radius: 50px;
							border: 1px solid #ddd; max-width: 350px; margin: 0 auto 20px auto;
						}
						.nav-arrow {
							width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
							background: #001f3f; color: white !important; border-radius: 50%;
							transition: all 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
						}
						.nav-arrow:hover { background: #007bff; transform: scale(1.1); }
						#salary_month { border: none; background: transparent; font-weight: bold; font-size: 1.1rem; color: #001f3f; width: 170px; text-align: center; }
						.payable-amount { color: #28a745; font-weight: 800; background: #eafaf1; padding: 4px 8px; border-radius: 4px; border: 1px solid #28a745; display: inline-block; }
						.advance-amount { color: #dc3545; font-weight: 800; background: #fff5f5; padding: 4px 8px; border-radius: 4px; border: 1px solid #dc3545; display: inline-block; }
						.badge-half { background-color: #ffc107; color: #212529; font-weight: bold; }
					</style>

					<div class="card-tools no-print">
						<button class="btn btn-sm btn-flat btn-success" onclick="window.print()"><i class="fa fa-print"></i> Print</button>
					</div>
					
					<div class="month-nav-container no-print shadow-sm">
						<a href="./?page=salery/salary_management&month=<?php echo $prev_month ?>" class="nav-arrow"><i class="fa fa-chevron-left"></i></a>
						<input type="month" id="salary_month" value="<?php echo $month ?>">
						<a href="./?page=salery/salary_management&month=<?php echo $next_month ?>" class="nav-arrow"><i class="fa fa-chevron-right"></i></a>
					</div>

					<div id="out-print">
						<div class="text-center mb-4">
							<h4><b>V-Tech RSMS</b></h4>
							<p>Salary Statement: <b><?php echo $month_text ?></b></p>
						</div>
						
						<div class="table-responsive">
							<table class="table table-bordered table-sm table-hover">
								<thead>
									<tr class="bg-navy text-white text-sm text-center">
										<th>#</th>
										<th class="text-left">Staff Name</th>
										<th>Attendance (P | HD)</th>
										<th>Earned Salary</th>
										<th class="text-warning">Commission</th>
										<th>Old Bal</th>
										<th class="text-danger">Advance</th>
										<th class="bg-light">Net Total</th>							
										<th class="text-center">Action</th>
									</tr>
								</thead>
								<tbody>
									<?php 
									$i = 1;
									$mechanics = $conn->query("SELECT id, CONCAT(firstname,' ',lastname) as name, daily_salary FROM mechanic_list WHERE status = 1 ORDER BY firstname ASC");
									
									while($row = $mechanics->fetch_assoc()):
										$mid = $row['id'];
										
										// --- 1. OLD BALANCE CALCULATION (Including Half Days) ---
										$total_earned_till_prev = 0;
										// Status 1 (Present) aur Status 3 (Half Day) dono ko check karein
										$history_att = $conn->query("SELECT curr_date, status FROM attendance_list WHERE mechanic_id = '$mid' AND status IN (1,3) AND curr_date <= '$prev_month_end'");
										while($h_row = $history_att->fetch_assoc()){
											$check_date = $h_row['curr_date'];
											$h_status = $h_row['status'];
											
											$rate_qry = $conn->query("SELECT salary FROM mechanic_salary_history WHERE mechanic_id = '$mid' AND effective_date <= '$check_date' ORDER BY effective_date DESC, id DESC LIMIT 1");
											$rate = ($rate_qry->num_rows > 0) ? $rate_qry->fetch_assoc()['salary'] : $row['daily_salary'];
											
											// Logic: Status 1 = Full Rate, Status 3 = Half Rate
											if($h_status == 3) $total_earned_till_prev += ($rate / 2);
											else $total_earned_till_prev += $rate;
										}
										
										$prev_comm = $conn->query("SELECT SUM(mechanic_commission_amount) FROM transaction_list WHERE mechanic_id = '$mid' AND date_created <= '$prev_month_end 23:59:59'")->fetch_array()[0] ?? 0;
										$total_adv_till_prev = $conn->query("SELECT SUM(amount) FROM advance_payments WHERE mechanic_id = '$mid' AND date_paid <= '$prev_month_end'")->fetch_array()[0] ?? 0;
										
										$old_balance = ($total_earned_till_prev + $prev_comm) - $total_adv_till_prev;

										// --- 2. CURRENT MONTH FIX SALARY ---
										$current_month_fix = 0;
										$present_count = 0;
										$half_day_count = 0;
										
										$attendance_qry = $conn->query("SELECT curr_date, status FROM attendance_list WHERE mechanic_id = '$mid' AND status IN (1,3) AND curr_date LIKE '{$month}%'");
										while($att_row = $attendance_qry->fetch_assoc()){
											$c_date = $att_row['curr_date'];
											$c_status = $att_row['status'];
											
											$rate_c_qry = $conn->query("SELECT salary FROM mechanic_salary_history WHERE mechanic_id = '$mid' AND effective_date <= '$c_date' ORDER BY effective_date DESC, id DESC LIMIT 1");
											$rate_c = ($rate_c_qry->num_rows > 0) ? $rate_c_qry->fetch_assoc()['salary'] : $row['daily_salary'];
											
											if($c_status == 3){
												$half_day_count++;
												$current_month_fix += ($rate_c / 2);
											} else {
												$present_count++;
												$current_month_fix += $rate_c;
											}
										}

										// --- 3. CURRENT MONTH COMMISSION ---
										$current_comm = $conn->query("SELECT SUM(mechanic_commission_amount) FROM transaction_list WHERE mechanic_id = '$mid' AND date_created LIKE '{$month}%'")->fetch_array()[0] ?? 0;

										// --- 4. CURRENT MONTH ADVANCE ---
										$current_month_adv = $conn->query("SELECT SUM(amount) FROM advance_payments WHERE mechanic_id = '$mid' AND date_paid LIKE '{$month}%'")->fetch_array()[0] ?? 0;

										// FINAL NET CALCULATION
										$net_final = ($old_balance + $current_month_fix + $current_comm) - $current_month_adv;
									?>
									<tr class="text-center">
										<td><?php echo $i++ ?></td>
										<td class="text-left">
    <a href="./?page=salery/view_mechanic_ledger&id=<?php echo $row['id'] ?>&month=<?php echo $month ?>" 
       class="text-navy font-weight-bold">
        <?php echo $row['name'] ?>
    </a>
</td>
										<td>
											<span class="text-success font-weight-bold"><?php echo $present_count ?></span> 
											<span class="text-muted">|</span> 
											<span class="badge badge-half"><?php echo $half_day_count ?></span>
										</td>
										<td class="text-right">₹<?php echo number_format($current_month_fix, 2) ?></td>
										<td class="text-right text-primary">₹<?php echo number_format($current_comm, 2) ?></td>
										<td class="text-right <?php echo $old_balance < 0 ? 'text-danger' : 'text-primary' ?>">₹<?php echo number_format($old_balance, 2) ?></td>
										<td class="text-right text-danger">₹<?php echo number_format($current_month_adv, 2) ?></td>
										<td class="text-right bg-light">
											<span class="<?php echo $net_final >= 0 ? 'payable-amount' : 'advance-amount' ?>">
												₹<?php echo number_format(abs($net_final), 2) ?>
											</span>
										</td>
										<td class="text-center">
											<?php if($net_final > 0): ?>
												<button type="button" class="btn btn-sm btn-success btn-flat pay_salary" 
														data-id="<?= $row['id'] ?>" 
														data-name="<?= $row['name'] ?>" 
														data-amount="<?= $net_final ?>">
													<i class="fa fa-money-bill-wave"></i> Pay
												</button>
											<?php else: ?>
												<span class="badge badge-light">Settled</span>
											<?php endif; ?>
										</td>
									</tr>
									<?php endwhile; ?>
								</tbody>
							</table>
						</div>
					</div>
				</div>
				<div class="tab-pane fade" id="control" role="tabpanel">
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
	$(function(){
		$('.pay_salary').click(function(){
			// Hum manage_advance.php ko call karenge aur parameters bhejenge
			var mid = $(this).attr('data-id');
			var amt = $(this).attr('data-amount');
			var name = $(this).attr('data-name');
			var month = "<?= $month_text ?>";
			
			// uni_modal function ka use karke modal open karenge
			uni_modal("<i class='fa fa-money-bill-wave'></i> Pay Salary to " + name, 
					  "salery/manage_advance.php?mechanic_id=" + mid + "&amount=" + amt + "&reason=Salary for " + month);
		})
		$('#salary_month').change(function(){
			location.href = "./?page=salary/salary_management&month=" + $(this).val();
		});

		$('.update_salary').click(function(){
			$('#salary-form [name="id"]').val($(this).attr('data-id'))
			$('#m_name').val($(this).attr('data-name'))
			$('#new_salary').val($(this).attr('data-salary'))
			$('#salary_modal').modal('show')
		})

		$('.view_history').click(function(){
			uni_modal("Salary History of "+$(this).attr('data-name'), "salery/view_salary_history.php?id="+$(this).attr('data-id'))
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
		$('.view_ledger').click(function(){
    var mid = $(this).attr('data-id');
    var month = $(this).attr('data-month');
    var name = $(this).attr('data-name');
    
    // Ledger dikhane ke liye uni_modal ko call karein
    uni_modal("<i class='fa fa-list'></i> Daily Ledger: " + name, 
              "salery/view_mechanic_ledger.php?id=" + mid + "&month=" + month, 
              "large");
});
	})
</script>
</DOCUMENT>