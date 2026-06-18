# Nutrition Module API Documentation

## 1. Food Management

Food items store nutritional values per 100g.

### Create Food Item

#### Endpoint

```http
POST /nutrition/foods
```

#### Request

```json
{
  "name": "Chicken Breast",
  "category": "MEAT",
  "brand": "Organic Farms",
  "calories": 165,
  "proteinG": 31,
  "carbsG": 0,
  "fatG": 3.6,
  "fiberG": 0,
  "sugarG": 0,
  "sodiumMg": 74,
  "cholesterolMg": 85,
  "saturatedFatG": 1,
  "transFatG": 0,
  "servingSize": "1 breast",
  "servingWeightG": 174,
  "barcode": "1234567890123"
}
```

#### Required Fields

```text
name
calories
proteinG
carbsG
fatG
```

#### Food Categories

```text
FRUIT VEGETABLE MEAT FISH DAIRY GRAIN LEGUME NUT SEED OIL BEVERAGE SNACK SUPPLEMENT OTHER
```

---

### List Foods

```http
GET /nutrition/foods
```

#### Filters

```http
GET /nutrition/foods?name=chicken
GET /nutrition/foods?category=MEAT
GET /nutrition/foods?brand=Organic
```

---

### Get Food Details

```http
GET /nutrition/foods/:id
```

---

### Update Food

```http
PATCH /nutrition/foods/:id
```

All fields are optional.

---

### Delete Food

```http
DELETE /nutrition/foods/:id
```

Soft delete:

```text
isActive = false
```

---

### Add Serving Size

```http
POST /nutrition/foods/:id/servings
```

```json
{
  "name": "1 Scoop",
  "weightG": 30
}
```

---

### Remove Serving Size

```http
DELETE /nutrition/foods/:id/servings/:servingId
```

---

# 2. Meal Management

Meals are combinations of food items.

## Create Meal

### Endpoint

```http
POST /nutrition/meals
```

### Request

```json
{
  "name": "Post Workout Shake",
  "description": "Quick recovery shake",
  "mealType": "POST_WORKOUT",
  "foodItems": [
    {
      "foodItemId": "",
      "servings": 1
    },
    {
      "foodItemId": "",
      "servings": 0.5
    }
  ]
}
```

---

### Meal Types

```text
BREAKFAST
LUNCH
DINNER
SNACK
PRE_WORKOUT
POST_WORKOUT
ANYTIME
```

---

### Response Example

```json
{
  "success": true,
  "data": {
    "id": "meal-id",
    "name": "Post Workout Shake",
    "nutrition": {
      "calories": 250.5,
      "proteinG": 30.2,
      "carbsG": 25,
      "fatG": 3.1,
      "fiberG": 1.2,
      "sugarG": 2.5
    }
  }
}
```

---

## List Meals

```http
GET /nutrition/meals
```

### Filters

```http
GET /nutrition/meals?name=shake
GET /nutrition/meals?mealType=POST_WORKOUT
```

---

## Get Meal

```http
GET /nutrition/meals/:id
```

---

## Update Meal

```http
PATCH /nutrition/meals/:id
```

Replaces existing food items.

All fields are optional; provide the fields you want to update.

---

## Delete Meal

```http
DELETE /nutrition/meals/:id
```

Soft delete is supported via `isActive = false`.

---

# 3. Meal Plans

Meal plans contain multiple days and scheduled meals.

## Create Meal Plan

### Endpoint

```http
POST /nutrition/plans
```

### Request

```json
{
  "name": "Cutting Diet - 7 Day",
  "goal": "WEIGHT_LOSS",
  "duration": 7,
  "days": [
    {
      "dayNumber": 1,
      "title": "Day 1",
      "notes": "Hydration focus",
      "meals": [
        {
          "mealId": "",
          "mealType": "BREAKFAST",
          "time": "08:00"
        },
        {
          "mealId": "",
          "mealType": "LUNCH",
          "time": "13:00"
        }
      ]
    }
  ]
}
```

### Required Fields

```text
name
goal
duration
days (array with at least one day)
```

### Meal Plan Goals

```text
WEIGHT_LOSS
WEIGHT_GAIN
MAINTAIN_WEIGHT
```

### Validation Rules

```text
Duration Validation: duration === days.length
Day Rules:
  - At least one meal per day
  - Unique dayNumber per day
```

---

## List Meal Plans

```http
GET /nutrition/plans
```

### Response Example

```json
{
  "success": true,
  "data": [
    {
      "id": "plan-id",
      "name": "Cutting Diet - 7 Day",
      "goal": "WEIGHT_LOSS",
      "duration": 7,
      "days": [
        {
          "dayNumber": 1,
          "title": "Day 1",
          "notes": "Hydration focus",
          "meals": [
            {
              "mealId": "meal-id",
              "mealType": "BREAKFAST",
              "time": "08:00"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Get Meal Plan

```http
GET /nutrition/plans/:id
```

### Response Includes

```text
Plan Nutrition Summary
Daily Nutrition Summary
```

### Response Example

```json
{
  "success": true,
  "data": {
    "id": "plan-id",
    "name": "Cutting Diet - 7 Day",
    "goal": "WEIGHT_LOSS",
    "duration": 7,
    "days": [...],
    "nutritionSummary": {
      "totalCalories": 12500,
      "totalProteinG": 875,
      "totalCarbsG": 1050,
      "totalFatG": 280
    },
    "dailySummary": [
      {
        "dayNumber": 1,
        "title": "Day 1",
        "calories": 1785,
        "proteinG": 125,
        "carbsG": 150,
        "fatG": 40
      }
    ]
  }
}
```

---

## Update Meal Plan

```http
PATCH /nutrition/plans/:id
```

All fields are optional; provide the fields you want to update.

### Request

```json
{
  "name": "Updated Plan Name",
  "goal": "WEIGHT_GAIN",
  "duration": 7,
  "days": [...]
}
```

---

## Delete Meal Plan

```http
DELETE /nutrition/plans/:id
```

Soft delete is supported via `isActive = false`.

---

# 4. Meal Plan Assignments

Meal plan assignments connect members to plans with a start date and optional notes.

## List Assignments

```http
GET /api/nutrition/assignments
```

### Response Example

```json
{
  "success": true,
  "data": [
    {
      "id": "assignment-id",
      "memberId": "member-id",
      "member": {
        "id": "member-id",
        "name": "Jane Doe",
        "email": "jane@example.com"
      },
      "planId": "plan-id",
      "plan": {
        "id": "plan-id",
        "name": "Cutting Diet - 7 Day"
      },
      "startDate": "2026-06-01",
      "notes": "Start with hydration focus",
      "archived": false
    }
  ]
}
```

---

## Create Assignment

```http
POST /api/nutrition/assign
```

### Request

```json
{
  "mealPlanId": "plan-uuid",
  "userId": "member-uuid",
  "startDate": "2026-06-15",
  "endDate": "2026-07-15",
  "notes": "Follow up in 2 weeks"
}
```

### Required Fields

```text
mealPlanId
userId
startDate
endDate
```

---

## Update Assignment

```http
PATCH /api/nutrition/assign/:id
```

### Request

```json
{
  "mealPlanId": "plan-uuid",
  "userId": "member-uuid",
  "startDate": "2026-06-16",
  "endDate": "2026-07-16",
  "notes": "Revised schedule"
}
```

All fields are optional; send only the fields you want to change.

---

## Delete Assignment

```http
DELETE /api/nutrition/assign/:id
```

Removes the assignment from the member schedule.

---

# 5. Diet Logs

Diet logs capture member meal entries, calories, and notes by date.

## My Diet Logs

```http
GET /api/nutrition/my/logs
```

Returns diet logs for the authenticated user.

## Member Diet Logs

```http
GET /api/nutrition/users/:userId/logs
```

Returns diet logs for a specific member.

## Create Diet Log

```http
POST /api/nutrition/logs
```

### Request

```json
{
  "userId": "member-uuid",
  "entryDate": "2026-06-15",
  "mealType": "LUNCH",
  "description": "Chicken salad and sweet potato",
  "calories": 550,
  "notes": "Pre-workout meal"
}
```

### Required Fields

```text
userId
entryDate
mealType
```

---

## Update Diet Log

```http
PATCH /api/nutrition/logs/:id
```

All fields are optional; send only the fields you want to change.

## Delete Diet Log

```http
DELETE /api/nutrition/logs/:id
```

