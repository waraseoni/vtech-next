<?php 
// Fetch Next expected Job ID for display purpose only
$last_job_qry = $conn->query("SELECT last_job_id FROM job_id_counter");
$next_job_id = ($last_job_qry->num_rows > 0) ? $last_job_qry->fetch_assoc()['last_job_id'] + 1 : 27652;
?>

<div class="content py-3">
    <div class="container-fluid">
        <div class="card card-outline card-success shadow rounded-0">
            <div class="card-header rounded-0 bg-navy">
                <h3 class="card-title text-white">
                    <i class="fa fa-layer-group"></i> <b>Bulk Job Sheet Entry (Multi-Item)</b>
                </h3>
                <div class="card-tools">
                    <a href="./?page=transactions" class="btn btn-light btn-sm border rounded-0">
                        <i class="fa fa-times"></i> Cancel
                    </a>
                </div>
            </div>
            
            <div class="card-body">
                <form id="bulk-transaction-form">
                    
                    <div class="row mb-4 p-3 bg-light border">
                        <div class="col-md-5">
                            <label class="control-label text-navy font-weight-bold">
                                <i class="fa fa-user"></i> Select Client <span class="text-danger">*</span>
                            </label>
                            <select name="client_name" id="client_name" class="form-control select2" required>
                                <option value="" disabled selected>Search Client...</option>
                                <?php 
                                $clients = $conn->query("SELECT *, CONCAT(firstname,' ',IFNULL(middlename,''),' ',lastname) as name FROM client_list WHERE delete_flag = 0 ORDER BY name ASC");
                                while($row = $clients->fetch_assoc()):
                                ?>
                                <option value="<?= $row['id'] ?>"><?= $row['name'] ?> (<?= $row['contact'] ?>)</option>
                                <?php endwhile; ?>
                            </select>
                        </div>

                        <div class="col-md-4">
                            <label class="control-label text-navy font-weight-bold">
                                <i class="fa fa-tools"></i> Default Mechanic
                            </label>
                            <select id="global_mechanic" class="form-control select2">
                                <option value="" disabled selected>Select Default Mechanic</option>
                                <?php 
                                $mechs = $conn->query("SELECT *, CONCAT(firstname,' ',lastname) as name FROM mechanic_list WHERE delete_flag = 0 AND status = 1 ORDER BY name ASC");
                                while($row = $mechs->fetch_assoc()):
                                ?>
                                <option value="<?= $row['id'] ?>"><?= $row['name'] ?></option>
                                <?php endwhile; ?>
                            </select>
                        </div>

                        <div class="col-md-3 text-right d-flex align-items-end justify-content-end">
                            <div class="h5 mb-0">Start Job ID: <span class="badge badge-warning" id="start_job_id"><?= $next_job_id ?></span></div>
                        </div>
                    </div>

                    <div class="desktop-table-view table-responsive d-none d-md-block">
                        <table class="table table-bordered table-striped table-hover" id="bulk-table">
                            <thead class="bg-success text-white">
                                <tr>
                                    <th width="5%" class="text-center">#</th>
                                    <th width="12%">Job ID (Est.)</th>
                                    <th width="20%">Item / Model <span class="text-danger">*</span></th>
                                    <th width="20%">Fault Reported <span class="text-danger">*</span></th>
                                    <th width="15%">Assign To</th>
                                    <th width="12%">Unique ID</th>
                                    <th width="12%">Remarks</th>
                                    <th width="5%" class="text-center"><i class="fa fa-trash"></i></th>
                                </tr>
                            </thead>
                            <tbody>
                                </tbody>
                        </table>
                    </div>

                    <div class="mobile-card-view d-block d-md-none">
                        <div id="mobile-list">
                            </div>
                    </div>

                    <div class="row mt-4 border-top pt-3">
                        <div class="col-md-6 col-6">
                            <button type="button" class="btn btn-info btn-flat" id="add_row_btn">
                                <i class="fa fa-plus"></i> Add New Row
                            </button>
                        </div>
                        <div class="col-md-6 col-6 text-right">
                            <button type="submit" class="btn btn-primary btn-flat px-5" id="save_all_btn">
                                <i class="fa fa-save"></i> Save All Items
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<script>
    var mechanics_opts = '<option value="">Select Mechanic</option>';
    <?php 
    $mechs->data_seek(0);
    while($row = $mechs->fetch_assoc()): ?>
        mechanics_opts += '<option value="<?= $row['id'] ?>"><?= addslashes($row['name']) ?></option>';
    <?php endwhile; ?>

    var base_job_id = <?= $next_job_id ?>;

    $(document).ready(function(){
        $('.select2').select2({width:'100%'});

        // Initial 3 rows
        for(let i=0; i<3; i++) add_new_row();

        $('#add_row_btn').click(function(){
            add_new_row();
        });

        $('#global_mechanic').change(function(){
            var mid = $(this).val();
            $('.row-mechanic').each(function(){
                if($(this).val() == "") $(this).val(mid);
            });
        });

        $(document).on('click', '.remove-row', function(){
            var index = $(this).closest('.item-wrapper').data('index');
            if($('.desktop-row').length > 1){
                $(`.item-wrapper[data-index="${index}"]`).remove();
                reindex_rows();
            } else {
                alert_toast("At least one row is required.", "warning");
            }
        });
    });

    function add_new_row(){
        // Hum sirf desktop rows ko ginte hain index nikalne ke liye
        var row_idx = $('.desktop-row').length;
        var current_job_id = base_job_id + row_idx;
        var default_mech = $('#global_mechanic').val();

        var desktopRow = `
            <tr class="item-wrapper desktop-row" data-index="${row_idx}">
                <td class="text-center align-middle row-num">${row_idx + 1}</td>
                <td class="align-middle">
                    <input type="text" class="form-control text-center bg-light job-id-display" readonly value="${current_job_id}">
                </td>
                <td><input type="text" class="form-control item-input row-input" placeholder="Item" required></td>
                <td><input type="text" class="form-control fault-input row-input" placeholder="Fault" required></td>
                <td><select class="form-control row-mechanic row-input">${mechanics_opts}</select></td>
                <td><input type="text" class="form-control uniq-input row-input" placeholder="ID"></td>
                <td><input type="text" class="form-control remark-input row-input" placeholder="Remarks"></td>
                <td class="text-center align-middle">
                    <button type="button" class="btn btn-sm btn-danger remove-row"><i class="fa fa-times"></i></button>
                </td>
            </tr>
        `;
        
        var mobileCard = `
            <div class="item-wrapper mobile-card item-card" data-index="${row_idx}">
                <span class="card-row-num">#${row_idx + 1}</span>
                <div class="form-group mb-2">
                    <label class="small mb-0">Job ID</label>
                    <input type="text" class="form-control bg-light job-id-display" readonly value="${current_job_id}">
                </div>
                <div class="form-group mb-2">
                    <label class="small mb-0">Item / Model *</label>
                    <input type="text" class="form-control item-input" placeholder="Item Name / Model" required>
                </div>
                <div class="form-group mb-2">
                    <label class="small mb-0">Fault Reported *</label>
                    <input type="text" class="form-control fault-input" placeholder="Reported Fault" required>
                </div>
                <div class="form-group mb-2">
                    <label class="small mb-0">Assign To</label>
                    <select class="form-control row-mechanic">${mechanics_opts}</select>
                </div>
                <div class="form-group mb-2">
                    <label class="small mb-0">Unique ID</label>
                    <input type="text" class="form-control uniq-input" placeholder="Location/ID">
                </div>
                <div class="form-group mb-2">
                    <label class="small mb-0">Remarks</label>
                    <input type="text" class="form-control remark-input" placeholder="Additional notes">
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger btn-block remove-row">
                    <i class="fa fa-times"></i> Remove This Item
                </button>
            </div>
        `;
        
        $('#bulk-table tbody').append(desktopRow);
        $('#mobile-list').append(mobileCard);
        
        if(default_mech) {
            $(`.item-wrapper[data-index="${row_idx}"] .row-mechanic`).val(default_mech);
        }
        
        sync_row_inputs(row_idx);
    }

    function sync_row_inputs(index) {
        $(`.item-wrapper[data-index="${index}"] input, .item-wrapper[data-index="${index}"] select`).on('input change', function() {
            var classes = $(this).attr('class').split(' ');
            var targetClass = classes.find(c => c.includes('-input') || c === 'row-mechanic');
            $(`.item-wrapper[data-index="${index}"] .${targetClass}`).not(this).val($(this).val());
        });
    }

    function reindex_rows() {
        // Sirf desktop rows ke hisab se counting reset karein
        $('.desktop-row').each(function(i){
            var old_index = $(this).attr('data-index');
            var new_job_id = base_job_id + i;
            
            // Update Desktop Row
            $(this).attr('data-index', i);
            $(this).find('.row-num').text(i + 1);
            $(this).find('.job-id-display').val(new_job_id);
            
            // Corresponding Mobile Card ko find karke update karein
            var mobileCard = $(`.mobile-card[data-index="${old_index}"]`);
            mobileCard.attr('data-index', i);
            mobileCard.find('.card-row-num').text('#' + (i + 1));
            mobileCard.find('.job-id-display').val(new_job_id);
        });
    }

    $('#bulk-transaction-form').submit(function(e){
        e.preventDefault();
        var data = [];
        var valid = true;

        $('.desktop-row').each(function(){
            var row = $(this);
            var item = row.find('.item-input').val().trim();
            var fault = row.find('.fault-input').val().trim();
            var mech = row.find('.row-mechanic').val();
            
            if(item != "" && fault != ""){
                if(mech == ""){
                    alert_toast("Please select mechanic for " + item, "warning");
                    valid = false;
                    return false;
                }
                data.push({
                    job_id: row.find('.job-id-display').val(),
                    item: item,
                    fault: fault,
                    mechanic_id: mech,
                    uniq_id: row.find('.uniq-input').val(),
                    remark: row.find('.remark-input').val()
                });
            }
        });

        if(!valid) return;
        if(data.length === 0){
            alert_toast("Please fill at least one item details.", "warning");
            return;
        }

        $('#save_all_btn').attr('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');
        start_loader();

        $.ajax({
            url: _base_url_+"classes/Master.php?f=save_multi_transaction",
            method: 'POST',
            data: {
                client_name: $('#client_name').val(),
                items: JSON.stringify(data)
            },
            dataType: 'json',
            success: function(resp){
                end_loader();
                if(resp.status == 'success') location.replace('./?page=transactions');
                else {
                    alert_toast(resp.msg || "Error", "error");
                    $('#save_all_btn').attr('disabled', false).html('<i class="fa fa-save"></i> Save All Items');
                }
            }
        });
    });
</script>

<style>
    .item-card { background: #fff; border: 1px solid #ddd; border-left: 5px solid #28a745; margin-bottom: 15px; padding: 15px; border-radius: 5px; position: relative; }
    .card-row-num { position: absolute; top: 5px; right: 10px; font-weight: bold; color: #ccc; font-size: 1.2rem; }
</style>