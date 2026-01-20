import React from 'react'

const TextInputField = ({setVal, val, placeholder, password}) => {
  
  if (password){
    return(
      <input type="password" value={val} placeholder={placeholder} className='w-full bg-[#c3c3c3] placeholder:text-[#1f1f1f70] placeholder:font-medium text-black text-2xl p-4 rounded-md'
     onChange={({value})=>{
      setVal(value)
    }}
    />
    )
  }

  return (<input type="text" value={val} placeholder={placeholder} className='w-full bg-[#c3c3c3] placeholder:text-[#1f1f1f70] placeholder:font-medium text-black text-2xl p-4 rounded-md'
          onChange={({value})=>{
          setVal(value)
        }}
        />)

}

export default TextInputField