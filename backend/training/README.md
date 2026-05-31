# MealPlan AI Training Runner

Folder này chỉ dùng để training dữ liệu mealplan theo các chỉ số:
- `avgCalories`
- `dietType`
- `allergies`
- `activityLevel`

Script sẽ tạo nhiều case khác nhau, gọi AI để tạo mealplan, rồi lưu vào collection `mealplans`.
Mealplan do training tạo ra được gắn `generationSource=training` và `status=training` để không bị luồng draft thông thường của user xoá nhầm.

Default phân bổ case theo calories trong runner:
- `1500`: 50 case
- `1900`: 40 case
- `2100`: 40 case
- `2300`: 80 case
- `2500`: 80 case
- `2700`: 80 case
- `2900`: 80 case
- `3100`: 40 case

Riêng khi chạy `--duration=14`, runner tự đổi sang profile:
- `1500`: 20 case
- `1700`: 20 case
- `1900`: 40 case
- `2100`: 40 case
- `2300`: 40 case
- `2500`: 40 case
- `2700`: 40 case
- `2900`: 40 case
- `3100`: 20 case

Riêng khi chạy `--duration=3`, runner dùng profile ngắn hạn:
- `1500`: 16 case
- `1700`: 16 case
- `1900`: 24 case
- `2100`: 24 case
- `2300`: 24 case
- `2500`: 24 case
- `2700`: 24 case
- `2900`: 24 case
- `3100`: 16 case

Riêng khi chạy `--duration=30`, runner dùng profile dài hạn:
- `1500`: 24 case
- `1700`: 24 case
- `1900`: 48 case
- `2100`: 48 case
- `2300`: 48 case
- `2500`: 48 case
- `2700`: 48 case
- `2900`: 48 case
- `3100`: 24 case

## Cách chạy

Từ folder `backend`:

```bash
npm run train:mealplans -- --userId=<mongodb_user_id>
```

Preset cho `EXE_dev` với một lệnh cố định:

```bash
npm run train:mealplans:exe-dev
```

Preset này sẽ:
- ưu tiên lấy `TRAINING_USER_ID` từ file `.env`
- nếu không có thì tự lấy user đầu tiên trong DB `EXE_dev`
- dùng mặc định an toàn cho quota: `batchSize=20`, `delayMs=800`, `interBatchDelayMs=20000`, `forceAIGenerate=true`

Bạn vẫn có thể override khi cần:

```bash
npm run train:mealplans:exe-dev -- --maxBatches=2 --startBatch=3
```

## Audit và migrate dữ liệu cũ

Nếu trước đây training mealplan bị lưu ở `status=draft`, có thể kiểm tra và chuyển chúng sang `status=training` bằng:

```bash
npm run training:audit
npm run training:migrate-status
```

## Tuỳ chọn hữu ích

- `--limit=50`: chỉ chạy 50 case đầu tiên.
- `--duration=7`: số ngày mỗi mealplan.
- `--planType=premium`.
- `--delayMs=500`: delay giữa các case (ms).
- `--batchSize=20`: số case trong mỗi batch.
- `--interBatchDelayMs=15000`: thời gian nghỉ giữa 2 batch.
- `--startBatch=1`: bắt đầu từ batch số mấy.
- `--maxBatches=2`: chỉ chạy tối đa bao nhiêu batch trong lần này.
- `--targetSamplesPerCase=1`: nếu case đã có đủ số mẫu này trong DB thì script sẽ tự skip.
- `--forceAIGenerate=true`: bỏ qua bước tìm tương tự trong DB để luôn tạo mới bằng AI.
- `--forceAIGenerate=false`: cho phép tận dụng mealplan tương tự trong DB.
- `--calories=2100`: lọc theo avgCalories.
- `--skipCalories=1500`: bỏ qua một hay nhiều mức calories (csv), ví dụ `1500,1900`.
- `--dietType=vegan`: lọc theo dietType.
- `--activityLevel=moderate`: lọc theo activityLevel.
- `--allergies=soy,nuts`: lọc theo đúng bộ dị ứng.

## Gợi ý chạy theo batch

```bash
npm run train:mealplans -- --userId=<mongodb_user_id> --limit=80 --batchSize=20 --interBatchDelayMs=20000 --delayMs=800
```

Chạy nhiều batch nhỏ sẽ ổn định hơn nếu API Gemini bị quota/throttle.

Script sẽ gắn `trainingCaseKey` cho dữ liệu training và tự bỏ qua case đã đủ quota khi chạy lại, giúp hạn chế tạo dữ liệu trùng quá nhiều.

Ví dụ chạy từ batch thứ 3 và chỉ chạy 2 batch:

```bash
npm run train:mealplans -- --userId=<mongodb_user_id> --batchSize=20 --startBatch=3 --maxBatches=2
```
