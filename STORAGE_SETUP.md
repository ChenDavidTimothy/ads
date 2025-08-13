# Storage Setup Guide

This guide will help you set up the new separated storage architecture for images and videos.

## Prerequisites

- Supabase project with storage enabled
- Access to Supabase dashboard
- Environment variables configured

## Step 1: Create Storage Buckets

In your Supabase dashboard:

1. Go to **Storage** → **Buckets**
2. Click **Create a new bucket**
3. Create two buckets:
   - **Bucket name**: `images`
   - **Bucket name**: `videos`
4. Set both to **Private** (unless you need public access)

## Step 2: Update Environment Variables

Add these to your `.env.local`:

```bash
# Storage bucket configuration
SUPABASE_IMAGES_BUCKET=images
SUPABASE_VIDEOS_BUCKET=videos

# Legacy support (optional)
SUPABASE_STORAGE_BUCKET=videos
```

## Step 3: Set Up Bucket Policies

Run the SQL script in `scripts/setup-storage-buckets.sql` in your Supabase SQL editor.

This will create RLS policies that:
- Allow users to access only their own files
- Separate permissions for images and videos
- Maintain security boundaries between content types

## Step 4: Test the Setup

1. Restart your development server
2. Try rendering both an image and a video
3. Check that they appear in the correct buckets:
   - Images → `images` bucket
   - Videos → `videos` bucket

## Step 5: Verify Bucket Separation

In your Supabase dashboard:

1. Go to **Storage** → **Buckets**
2. Check the `images` bucket - should contain PNG/JPEG files
3. Check the `videos` bucket - should contain MP4 files
4. Verify file paths follow the pattern: `{userId}/{filename}`

## File Structure

Your files will now be organized like this:
```
images bucket:
  └── {userId}/scene_{timestamp}_{uuid}.png
  └── {userId}/scene_{timestamp}_{uuid}.jpeg

videos bucket:
  └── {userId}/scene_{timestamp}_{uuid}.mp4
```

**Note**: The intermediate "animations" folder has been removed for cleaner organization.

## Troubleshooting

### Images Still Going to Videos Bucket
- Check that `SUPABASE_IMAGES_BUCKET` is set correctly
- Verify the bucket name matches exactly (case-sensitive)
- Restart your development server

### Permission Errors
- Ensure RLS is enabled on both buckets
- Verify the SQL policies were created successfully
- Check that your service role key has access

### Legacy Files
- Old files will remain in their original bucket
- New files will be routed to the correct bucket
- Consider migrating old files if needed

## Migration from Single Bucket

If you're migrating from a single bucket setup:

1. **Don't delete the old bucket yet** - keep it as backup
2. **Test thoroughly** with the new setup
3. **Verify all functionality works** with separated buckets
4. **Consider data migration** if you want to reorganize existing files
5. **Remove old bucket** only after confirming everything works

## Benefits of This Setup

- **Security**: Separate access controls per content type
- **Performance**: Optimized CDN strategies per bucket
- **Cost Management**: Better storage tiering
- **Compliance**: Content-specific retention policies
- **Scalability**: Independent monitoring and scaling
- **Maintenance**: Clearer organization and debugging
