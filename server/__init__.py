def removeDuplicates(nums):
    if not nums:
        return 0
    
    # i is the "Slow Pointer" (tracks where the last unique element is)
    i = 0 
    
    # j is the "Fast Pointer" (starts at 1 and scans the whole list)
    for j in range(1, len(nums)):
        if nums[j] != nums[i]:
            i += 1
            nums[i] = nums[j]
            
    # The number of unique elements is i + 1
    return i + 1

print(removeDuplicates([0, 0, 1, 1, 1, 2, 2, 3, 3, 4]))