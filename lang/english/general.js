module.exports = {
  error: 'Something went wrong.',
  error_with: 'Something went wrong with ##.',
  reg_success: 'Welcome! You are registered successfully.',
  deposit_amount: 'You must add ## rupees to purchase the tickets',
  already_initiated: '## process already initiated',
  already_assigned:
    '## is already assigned to a user, and cannot be reassigned',
  success: '## fetched successfully.',
  successfully: '## successfully.',
  action_success: '## successful.',
  cancel_success: '## cancel successful.',
  sent_success: '## sent successfully.',
  not_allow: "You're not allowed to update bank details",
  cBackgroundProcess: '## Background process started',
  cGenerationProcess: '## Creation process started',
  win_dist_exist: 'Win prize already distributed',

  action_failure: '## failed.',
  generate_success: '## generated successfully.',
  add_success: '## added successfully.',
  schedule_success: '## scheduled successfully.',
  schedule_date_err: "Scheduled date can't be past.",
  schedule_time_err: '### should be between ## and #.',
  update_success: '## updated successfully.',
  refresh_success: '## refreshed successfully.',
  del_success: '## deleted successfully.',
  submit_success: '## submitted successfully.',
  fields_missing: '## missing',
  fail: 'Failed',
  route_not_found: 'Page Not Found.',
  fix_len_err: '## must be # character long.',
  required: '## is required.',
  invalid: '## is invalid.',
  valid: '## is valid.',
  already_exist: '## already exists.',
  are_already_exist: '## are already exist.',
  already_added: '## is already Added.',
  not_exist: '## does not exist.',
  user_not_found: 'User not found with given mobile number.',
  not_found: '## not found',
  not_found_for: '## not found for the #',
  err_unauthorized: 'Authentication failed. Please login again!',
  user_blocked:
    'You are blocked by our system. Contact administrator for more details.',
  err_otp_expired: 'OTP is no longer valid, Please try again.',
  succ_logout: 'You have successfully logged out!',
  succ_login: 'Welcome Back! You have logged in successfully.',
  went_wrong_with: 'Something went wrong with ##',
  presigned_succ: 'Pre-signed URL generated successfully.',
  must_alpha_num: 'Username allows alphanumeric characters only.',
  auth_failed: 'Please enter a valid credentials.',
  social_auth_failed: 'Please enter a valid social credentials.',
  err_resend_otp: 'You can resend OTP only after ## seconds.',
  old_new_field_same: "Old and New ## can't be same.",
  wrong_old_field: 'Please enter a correct old field.',
  user_forgot_err:
    "We didn't find any account in our system. Please check your input first.",
  OTP_sent_succ: 'OTP sent successfully.',
  verify_otp_err: 'Entered OTP is invalid or expired.',
  verification_success: 'Verification done successfully.',
  no_match_scheduled: 'No Matches scheduled for this date.',
  no_lineups: 'Playing 11 are not scheduled.',
  no_kabaddi_lineups: 'Starting 7 are not scheduled.',
  no_basketball_lineups: 'Starting 5 are not scheduled.',
  block_user_err:
    'This user is blocked by admin. Please contact to administrator for further assistance.',
  reset_pass_succ:
    'Your password has been reset successfully. Please login using new password.',
  forgot_link_err:
    'Link is expired or invalid. Please try again or contact to administrator for further assistance.',
  already_verified: '## is already verified.',
  daterange_not_proper: 'Given date range is not in Proper format',
  days_daterange_error: 'Only Last 7 or less days data should be generated',
  month_daterange_error: 'Only Last 12 or less months data should be generated',
  year_daterange_error: 'Only Last 5 or less days years should be generated',
  match_not_started: 'Match has not started.',
  kyc_under_review:
    'Your KYC is currently under review. Please contact administrator if you need any assistance.',
  limit_reached:
    'You have reached a limit for sending ##. Please try after some time.',
  otp_limit_reached:
    "You've exceeded maximum attempts. Please try after 10 minutes.",
  err_bank_update:
    'You can update bank details only once. Contact to administrator for change request.',
  err_profile_update: 'Contact our support team to update your ##.',
  link_expire_invalid:
    'This link seems to be expired or invalid. Please try again.',
  kyc_status_v_err: "You can't verify this document.",
  less_then_err: '## should be less then ₹#.',
  greater_then_err: '## should be greater than ₹#.',
  fixed_size_err: '## should be only #.',
  same_value_err: "## and # can't be same.",
  unique_team_player_err: 'All team players should be unique',
  match_started: 'Match already started.',
  league_full: 'League is already full.',
  user_already_joined: 'You have already joined the league with this team.',
  multiple_join_err: "You can't join the league with multiple teams.",
  team_join_limit_err: 'You have reached a limit for team join.',
  match_not_complete: 'Match is not completed.',
  match_not_upcoming: 'Match is not upcoming.',
  match_update_err:
    'All ## is not properly either cancelled or win distributed.',
  no_matchplayer: 'No Match player scheduled for this match.',
  max_team_player_err: 'You can select maximum ## player from a team.',
  win_amount_err: 'Choose Winning amount between 1 and 10000.',
  contest_size_err: 'Choose Contest size between 2 and 500.',
  min_err: '## amount should be ₹# or higher.',
  max_err: '## amount should be ₹# or less.',
  mob_verify_err: 'Mobile number is not verified. Please verify it first.',
  email_verify_err:
    'Email is not verified. Please verify your email by using the otp sent in your mail.',
  social_email_error: 'Email is not verified. Please verify your email once',
  fill_profile_err: 'Fill user profiles !!',
  fill_bankdetails_err: 'Fill user bank details !!',

  invalid_promo_err: 'Entered promocode is either expired or inactive.',
  promo_amount_err:
    'This promocode is only available for deposit amount between ₹# to ₹##.',
  promo_usage_limit: 'You have reached usage limit for this promocode.',
  is_not_active: '## is not active.',
  is_active: '## is active.',
  insuff_balance: 'Insufficient balance for ##',
  pancard_not_approved: 'Your Pancard is not approved.',
  aadharcard_not_approved: 'Your Aadharcard is not approved.',
  kyc_not_approved: 'Your KYC has not yet been approved.',
  image_not_required: '## is not required',
  withdraw_process_err: 'This withdraw process already completed',
  contest_past_date_err: 'Contest date should be a future date.',
  contest_rp_ac: 'Ready to play contest will always auto create.',
  wp_percentage_err: 'Total of winning pattern percentage should be 100%.',
  past_date_err: '## date should be a future date.',
  future_date_err: '## date should be a past date.',
  expired_days_err: '## day should be a greater than or equal to 1.',
  compiled_success: 'File compiled successfully.',
  upload_excel_file: 'Please upload a excel file',
  access_denied: "You don't have permission",
  series_pending: 'Series is pending',
  league_already_cancel: 'Match League already canceled',
  league_prize_done: 'You can not cancel match league after price done',
  depo_already_process: 'Deposit already process',
  rp_not_allowrd_in_non_poolprize_league:
    'RP is not allowed in non Pool prize league',
  extra_not_allowed_in_poolprize_league:
    'Extra Prize breakdown is not allowed in Pool prize league',
  already_in_use: 'You can not update the ## type as it is already in use',
  cant_change_mobile_email: 'You can not change the email and mobile number',
  cant_change_email: 'You can not change the email. Please contact to administrator for change request.',
  withdraw_not_permited: '## can not withdraw amount',
  public_league_join_err: "You can't join the public leagues.",
  league_join_err: "You can't join the this league.",
  league_copy_success: 'League copied successfully in ##',

  complain_already_declined: 'Your complaint has already been declined.',
  complain_already_resolved: 'Your complaint is already resolved.',
  complain_already_inprogress: 'Your complaint is already inprogress.',

  complaints_already_declined: 'Your complaint is already declined.',
  complaints_already_resolved: 'Your complaint is already resolved.',
  complaints_already_inprogress: 'Your complaint is already inprogress.',

  declined_comment: 'Please enter a declined reason.',
  join_contest_succ: 'Contest joined successfully.',
  not_allowed_with: '## is not allowed with #.',
  play_alone_error: 'Why play alone? Please increase your contest size.',
  bank_already_process: 'Bank details already processed.',
  invalid_payout: 'This withdraw method not available.',
  invalid_signature: 'Signature is invalid.',
  date_filter_err: 'Please select date range for export data.',
  select_date_err: 'Please select date range.',

  pending_match_remove: 'Pending Matches removed successfully.',
  no_pending_match_remove: 'No Pending Matches Found.',
  sports_err: 'This sports is not available.',
  invalid_pass:
    'Password must contain at least eight characters, at least one number and both lower and uppercase letters and special characters.',
  error_payout_process:
    'Error while processing cashfree payouts money request transfer is ##.',
  error_payout_balance_check:
    'Error while checking balance in cashfree payouts is ##.',
  error_payout_fetchOrAdd_Beneficiary:
    'Error while fetching or adding beneficiary details in cashfree payouts is ##.',
  withdraw_request_success:
    'Your withdrawal request was submitted successfully. Amount will be credited to your account once approved.',
  pending_withdrawal_exists: 'There is already a pending withdrawal',
  invalid_team_size_err:
    'You can not update match in in-review state some of the user team contains invalid number of players.',
  read_access_denied: "You don't have read permission for ##",
  write_access_denied: "You don't have write permission for ##",
  machplayer_exist: 'Match player exists in user team.',
  pool_prize_breakup_err:
    'Please update prize breakdown for pool prize league.',
  queued_success: 'Overflow ## pushed to queued for processing successfully.',
  hidden_league_cat_delete_err:
    'You can not delete system generated hidden league category.',
  cannot_edit_player_role:
    'You cannot edit matchplayer role if match is not in pending or upcoming status.',
  deposit_success: "You'r account has been successfully credited.",
  cseriesAlreadyDistributeAndNotExist:
    'Either ## does not exist or Prize already Distributed',
  kyc_info:
    'Your name must be similar in PAN, Aadhaar, and Bank details for successful KYC approval.',

  kyc_approval: 'Your kyc will be approved with in 48 hours.',

  point_calculate_error: "Please calculate the user's points properly.",
  rank_calculate_error: "Please calculate the user's ranks properly.",
  prize_calculate_error: "Please calculate the user's prize properly.",
  tds_calculate_error: "Please calculate the user's tds properly.",
  no_series_category_remove: 'You can not delete win distributed category',
  wait_for_proccessing:
    'Please wait for a while we are already processing this ## request',
  check_live_leagues: 'Check live leagues cron ran successfully',
  cannot_update_match_format:
    "Can't update match format as winning is distributed for this match.",
  reject_reason_required: 'Reject reason required',
  reject_reason_invalid: 'Invalid reject reason',
  enter_valid_referral_code: 'Referral code is case sensitive, Please enter valid referral code.',
  min_entry_greater_than_pb: 'Minimum entry should greater than or equal to league prize breakup',
  thanks_for_contacting: 'Thank you for contacting us and providing us your valuable time',
  combination_update: 'Combination bot background update started successfully!',
  already_updated: '## are already updated.',
  subscribePushToken_success: 'Push Token Subscribed successfully.',
  not_uploaded_anything: 'Error! Cannot process empty payload',
  uploaded_pan_not_verified: 'Error! Uploaded PAN card could not be verified',
  uploaded_pan_verified: 'PAN Card details have been verified',
  uploaded_pan_rejected: 'Uploaded PAN card has been rejected',
  uploaded_aadhaar_not_verified: 'Uploaded aadhar could not be verified',
  uploaded_aadhaar_verified: 'Uploaded aadhar has been verified',
  uploaded_aadhaar_rejected: 'Uploaded aadhar has been rejected',
  uploaded_both_rejected: 'Both aadhar and PAN cards have been rejected',
  uploaded_both_waiting: 'Waiting on the results of verification please wait',
  uploaded_both_accepted: 'Both documents have been accepted and verified',
  image_not_clear: 'Image is non compliant to request/quality standard',
  below_eighteen: 'User age is below 18',
  name_does_not_match: 'Name does not match on Pan and Aadhar',
  dob_does_not_match: 'DOB does not match on Pan and Aadhar',
  aadhar_info_already_used: 'Aadhar info already used',
  blocked_location: 'Aadhar info is from blocked state',
  pan_already_used: 'Pan info already used',
  please_verify_pan_first: 'Pan info not uploaded or Verified',
  upcoming_join_err: '## should be upcoming or users already joined a league.',
  bonus_debited: '## bonus has debited due to bonus expiration',
  first_deposit_promo: 'This Promocode only applicable on first time deposit',
  matches_not_completed: 'There are no completed matches of this season with these teams.',
  unauthorize_err: 'Authentication failed. Please check auth token!',
  old_bot_logs_backup: 'Old bot logs backed up successfully.',
  old_bot_logs_deleted: 'Old bot logs deleted successfully.',
  userPromoCodeAlreadyExists: 'Promo Code for the user in league already exists.',
  invalid_user_promo_err: 'Coupon code not valid.',
  please_verify_Aadhaar_first: 'Please verify Aadhaar first',
  tdsBreakup: 'TDS breakup'
}