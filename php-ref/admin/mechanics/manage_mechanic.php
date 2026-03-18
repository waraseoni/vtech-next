<?php
require_once('../../config.php');
if(isset($_GET['id']) && $_GET['id'] > 0){
    $qry = $conn->query("SELECT * from `mechanic_list` where id = '{$_GET['id']}' ");
    if($qry->num_rows > 0){
        foreach($qry->fetch_assoc() as $k => $v){ $$k=$v; }
    }
}
$current_avatar = isset($avatar) && !empty($avatar) ? $avatar : 'default-avatar.jpg';
?>
<div class="container-fluid">
    <form action="" id="mechanic-form" enctype="multipart/form-data">
        <input type="hidden" name="id" value="<?php echo isset($id) ? $id : '' ?>">
        <input type="hidden" name="current_avatar" value="<?php echo $current_avatar ?>">
        
        <div class="row">
            <div class="col-md-4 text-center border-right">
                <div class="form-group">
                    <label for="avatar" class="control-label">Mechanic Photo</label>
                    <div class="mb-2">
                        <img src="<?php echo validate_image('uploads/avatars/'.$current_avatar) ?>" alt="" id="cimg" class="img-fluid img-thumbnail" style="width: 150px; height: 150px; object-fit: cover; border-radius: 50%;">
                    </div>
                    <div class="custom-file text-left">
                      <input type="file" class="custom-file-input" id="avatar" name="avatar" onchange="displayImg(this,$(this))" accept="image/*">
                      <label class="custom-file-label" for="avatar">Choose photo</label>
                    </div>
                </div>
            </div>

            <div class="col-md-8">
                
                <div class="row">
                    <div class="form-group col-md-4">
                        <label for="firstname" class="control-label">First Name</label>
                        <input type="text" name="firstname" id="firstname" class="form-control" value="<?php echo isset($firstname) ? $firstname : '' ?>" required>
                    </div>
                    <div class="form-group col-md-4">
                        <label for="middlename" class="control-label">Middle Name</label>
                        <input type="text" name="middlename" id="middlename" class="form-control" value="<?php echo isset($middlename) ? $middlename : '' ?>" placeholder="(Optional)">
                    </div>
                    <div class="form-group col-md-4">
                        <label for="lastname" class="control-label">Last Name</label>
                        <input type="text" name="lastname" id="lastname" class="form-control" value="<?php echo isset($lastname) ? $lastname : '' ?>" required>
                    </div>
                </div>

                <div class="row">
                    <div class="form-group col-md-6">
                        <label for="contact" class="control-label">Contact #</label>
                        <input type="text" name="contact" id="contact" class="form-control" value="<?php echo isset($contact) ? $contact : '' ?>" required>
                    </div>
                    <div class="form-group col-md-6">
                        <label for="designation" class="control-label">Designation</label>
                        <input type="text" name="designation" id="designation" class="form-control" value="<?php echo isset($designation) ? $designation : '' ?>" required>
                    </div>
                </div>

                <div class="row">
                    <div class="form-group col-md-6">
                        <label for="daily_salary" class="control-label">Daily Salary</label>
                        <input type="number" step="any" name="daily_salary" id="daily_salary" class="form-control text-right" value="<?php echo isset($daily_salary) ? $daily_salary : '' ?>" required>
                    </div>
                    <div class="form-group col-md-6">
                        <label for="commission_percent" class="control-label">Commission (%)</label>
                        <input type="number" step="any" name="commission_percent" id="commission_percent" class="form-control text-right" value="<?php echo isset($commission_percent) ? $commission_percent : 0 ?>" required>
                    </div>
                </div>

                <div class="row">
                <div class="form-group col-md-6">
                        <label for="status" class="control-label">Status</label>
                        <select name="status" id="status" class="form-control" required>
                            <option value="1" <?php echo isset($status) && $status == 1 ? 'selected' : '' ?>>Active</option>
                            <option value="0" <?php echo isset($status) && $status == 0 ? 'selected' : '' ?>>Inactive</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </form>
</div>

<script>
    function displayImg(input,_this) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                $('#cimg').attr('src', e.target.result);
                _this.siblings('.custom-file-label').html(input.files[0].name)
            }
            reader.readAsDataURL(input.files[0]);
        }
    }

    $(document).ready(function(){
        $('#mechanic-form').submit(function(e){
            e.preventDefault();
            var _this = $(this)
            $('.err-msg').remove();
            start_loader();
            $.ajax({
                url:_base_url_+"classes/Master.php?f=save_mechanic",
                data: new FormData($(this)[0]),
                cache: false,
                contentType: false,
                processData: false,
                method: 'POST',
                type: 'POST',
                dataType: 'json',
                error:err=>{
                    console.log(err)
                    alert_toast("An error occured",'error');
                    end_loader();
                },
                success:function(resp){
                    if(typeof resp =='object' && resp.status == 'success'){
                        location.reload()
                    }else if(resp.status == 'failed' && !!resp.msg){
                        var el = $('<div>')
                            el.addClass("alert alert-danger err-msg").text(resp.msg)
                            _this.prepend(el)
                            el.show('slow')
                            $("html, body").animate({ scrollTop: 0 }, "fast");
                    }else{
                        alert_toast("An error occured",'error');
                    }
                    end_loader();
                }
            })
        })
    })
</script>