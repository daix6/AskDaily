<template lang='jade'>
 .calendar
  header {{msg}}
</template>

<script>
export default {
  data() {
    return {
      msg: 'test'
    }
  }
};
</script>

<style scoped>

.calendar {
  color: red;
}

</style>
