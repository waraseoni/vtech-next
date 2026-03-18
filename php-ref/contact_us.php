<div class="col-12">
    <div class="row my-5">
        <div class="col-md-5">
            <div class="card card-outline card-primary rounded-0 shadow" style="background-color: #1e1e2d; border-color: #2d2d3d;">
                <div class="card-header" style="background-color: #151521; border-color: #2d2d3d;">
                    <h4 class="card-title text-light">Contact Information</h4>
                </div>
                <div class="card-body rounded-0 text-light" style="background-color: #1e1e2d;">
                    <dl>
                        <dt class="text-light-emphasis"><i class="fa fa-envelope"></i> Email</dt>
                        <dd class="pr-4 text-light"><?= $_settings->info('email') ?></dd>
                        <dt class="text-light-emphasis"><i class="fa fa-phone"></i> Contact #</dt>
                        <dd class="pr-4 text-light"><?= $_settings->info('contact') ?></dd>
                        <dt class="text-light-emphasis"><i class="fa fa-map-marked-alt"></i> Location</dt>
                        <dd class="pr-4 text-light"><?= $_settings->info('address') ?></dd>
                    </dl>
                </div>
            </div>
        </div>
        <div class="col-md-7">
            <div class="card rounded-0 card-outline card-primary shadow" style="background-color: #1e1e2d; border-color: #2d2d3d;">
                <div class="card-body rounded-0 text-light" style="background-color: #1e1e2d;">
                    <h2 class="text-center text-light">Message Us</h2>
                    <center><hr class="bg-primary border-primary w-25 border-2"></center>
                    <?php if($_settings->chk_flashdata('pop_msg')): ?>
                        <div class="alert alert-success" style="background-color: #0f5132; border-color: #0c4128; color: #d1e7dd;">
                            <i class="fa fa-check mr-2"></i> <?= $_settings->flashdata('pop_msg') ?>
                        </div>
                        <script>
                            $(function(){
                                $('html, body').animate({scrollTop:0})
                            })
                        </script>
                    <?php endif; ?>
                    <form action="" id="message-form">
                        <input type="hidden" name="id">
                        <div class="row">
                            <div class="col-md-6">
                                <input type="text" class="form-control form-control-sm form-control-border bg-dark text-light" id="fullname" name="fullname" required placeholder="Your Name" style="border-color: #4b4b5a;">
                                <small class="px-3 text-light-emphasis">Full Name</small>
                            </div>
                            <div class="col-md-6">
                                <input type="text" class="form-control form-control-sm form-control-border bg-dark text-light" id="contact" name="contact" required placeholder="xxxxxxxxxxxxx" style="border-color: #4b4b5a;">
                                <small class="px-3 text-light-emphasis">Contact #</small>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-md-6">
                                <input type="email" class="form-control form-control-sm form-control-border bg-dark text-light" id="email" name="email" required placeholder="xxxxxx@xxxxxx.xxx" style="border-color: #4b4b5a;">
                                <small class="px-3 text-light-emphasis">Email</small>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="form-group col-md-12">
                                <small class="text-light-emphasis">Message</small>
                                <textarea name="message" id="message" rows="4" class="form-control form-control-sm rounded-0 bg-dark text-light" required placeholder="Write your message here" style="border-color: #4b4b5a;"></textarea>
                            </div>
                        </div>
                        <div class="row mt-4">
                            <div class="form-group col-md-12 text-center">
                                <button class="btn btn-primary rounded-pill col-5" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none;">Send Message</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
<script>
    $(function(){
        $('#message-form').submit(function(e){
            e.preventDefault();
            var _this = $(this)
            $('.pop-msg').remove()
            var el = $('<div>')
                el.addClass("pop-msg alert")
                el.hide()
            start_loader();
            $.ajax({
                url:_base_url_+"classes/Master.php?f=save_message",
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
                    if(resp.status == 'success'){
                        location.reload();
                    }else if(!!resp.msg){
                        el.addClass("alert-danger")
                        el.css({
                            'background-color': '#2c0b0e',
                            'border-color': '#842029',
                            'color': '#ea868f'
                        })
                        el.text(resp.msg)
                        _this.prepend(el)
                    }else{
                        el.addClass("alert-danger")
                        el.css({
                            'background-color': '#2c0b0e',
                            'border-color': '#842029',
                            'color': '#ea868f'
                        })
                        el.text("An error occurred due to unknown reason.")
                        _this.prepend(el)
                    }
                    el.show('slow')
                    $('html, body').animate({scrollTop:0},'fast')
                    end_loader();
                }
            })
        })
    })
</script>